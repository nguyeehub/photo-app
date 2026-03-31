use image::imageops::FilterType;
use image::DynamicImage;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{BufReader, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use tauri::Manager;
use tokio::sync::Semaphore;
use walkdir::WalkDir;

// ── Concurrency limiter (A3) ───────────────────────────────────────────────
// Cap concurrent thumbnail generation to 4 to limit peak RAM usage.
// Using tokio::sync::Semaphore since Tauri async commands run on the tokio runtime.
static THUMBNAIL_SEMAPHORE: Semaphore = Semaphore::const_new(4);

// ── Data types ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageInfo {
    pub path: String,
    pub filename: String,
    /// Unix timestamp in milliseconds from EXIF DateTimeOriginal
    pub timestamp: Option<i64>,
    /// Human-readable timestamp string (e.g. "2025:01:15 14:30:45")
    pub timestamp_str: Option<String>,
    /// Date-only string for grouping (e.g. "2025-01-15")
    pub date_str: Option<String>,
    /// Width of the original image
    pub width: Option<u32>,
    /// Height of the original image
    pub height: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BurstGroup {
    pub id: usize,
    pub images: Vec<ImageInfo>,
    /// Display label for the group's time range
    pub label: String,
    pub count: usize,
    /// Date key for the group (from first image), e.g. "2025-01-15"
    pub date_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub groups: Vec<BurstGroup>,
    pub total_images: usize,
    pub directory: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheClearResult {
    pub files_removed: usize,
    pub bytes_freed: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    /// Whether this directory has subdirectories (for showing expand arrow)
    pub has_children: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VolumeInfo {
    pub name: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FavouriteFolder {
    pub name: String,
    pub path: String,
    /// Whether the path still exists on disk
    pub exists: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FavouritePhoto {
    pub path: String,
    /// Unix timestamp in milliseconds of when the photo was favourited
    pub favourited_at: i64,
}

// ── File detection ─────────────────────────────────────────────────────────

fn is_image_file(path: &Path) -> bool {
    match path.extension().and_then(|e| e.to_str()) {
        Some(ext) => matches!(
            ext.to_lowercase().as_str(),
            "jpg" | "jpeg" | "png" | "gif" | "bmp" | "webp" | "tiff" | "tif"
        ),
        None => false,
    }
}

fn is_jpeg_file(path: &Path) -> bool {
    match path.extension().and_then(|e| e.to_str()) {
        Some(ext) => matches!(ext.to_lowercase().as_str(), "jpg" | "jpeg"),
        None => false,
    }
}

// ── EXIF helpers ───────────────────────────────────────────────────────────

/// Extract EXIF DateTimeOriginal from an image file.
/// Returns (unix_timestamp_ms, datetime_string, date_only_string).
fn extract_exif_timestamp(path: &Path) -> Option<(i64, String, String)> {
    let file = fs::File::open(path).ok()?;
    let mut reader = BufReader::new(file);
    let exif_reader = exif::Reader::new();
    let exif = exif_reader.read_from_container(&mut reader).ok()?;

    let field = exif
        .get_field(exif::Tag::DateTimeOriginal, exif::In::PRIMARY)
        .or_else(|| exif.get_field(exif::Tag::DateTimeDigitized, exif::In::PRIMARY))
        .or_else(|| exif.get_field(exif::Tag::DateTime, exif::In::PRIMARY))?;

    let datetime_str = field.display_value().to_string();
    let (ts, date_str) = parse_exif_datetime(&datetime_str)?;
    Some((ts, datetime_str, date_str))
}

/// Extract the embedded JPEG thumbnail from EXIF IFD1 (A1).
/// Returns the raw JPEG bytes if present.
fn extract_exif_thumbnail(path: &Path) -> Option<Vec<u8>> {
    let file = fs::File::open(path).ok()?;
    let mut reader = BufReader::new(file);
    let exif_reader = exif::Reader::new();
    let exif = exif_reader.read_from_container(&mut reader).ok()?;

    let offset_field = exif.get_field(exif::Tag::JPEGInterchangeFormat, exif::In::THUMBNAIL)?;
    let length_field =
        exif.get_field(exif::Tag::JPEGInterchangeFormatLength, exif::In::THUMBNAIL)?;

    let offset = offset_field.value.get_uint(0)? as usize;
    let length = length_field.value.get_uint(0)? as usize;

    if length == 0 {
        return None;
    }

    let buf = exif.buf();
    if offset + length <= buf.len() {
        Some(buf[offset..offset + length].to_vec())
    } else {
        None
    }
}

/// Parse EXIF datetime string "YYYY:MM:DD HH:MM:SS" to (unix_timestamp_ms, date_only_string).
fn parse_exif_datetime(s: &str) -> Option<(i64, String)> {
    let s = s.trim().trim_matches('"');
    let parts: Vec<&str> = s.split(|c| c == ' ' || c == 'T').collect();
    if parts.len() < 2 {
        return None;
    }

    let date_parts: Vec<&str> = parts[0].split(|c| c == ':' || c == '-').collect();
    let time_parts: Vec<&str> = parts[1].split(':').collect();

    if date_parts.len() < 3 || time_parts.len() < 3 {
        return None;
    }

    let year: i32 = date_parts[0].parse().ok()?;
    let month: u32 = date_parts[1].parse().ok()?;
    let day: u32 = date_parts[2].parse().ok()?;
    let hour: u32 = time_parts[0].parse().ok()?;
    let minute: u32 = time_parts[1].parse().ok()?;
    let second: u32 = time_parts[2].parse().ok()?;

    let mut days: i64 = 0;
    for y in 1970..year {
        days += if is_leap_year(y) { 366 } else { 365 };
    }

    let month_days = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    for m in 1..month {
        days += month_days[m as usize] as i64;
        if m == 2 && is_leap_year(year) {
            days += 1;
        }
    }
    days += (day - 1) as i64;

    let timestamp_secs = days * 86400 + hour as i64 * 3600 + minute as i64 * 60 + second as i64;
    let date_str = format!("{:04}-{:02}-{:02}", year, month, day);

    Some((timestamp_secs * 1000, date_str))
}

fn is_leap_year(year: i32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)
}

// ── Thumbnail helpers ──────────────────────────────────────────────────────

fn get_thumbnail_cache_dir() -> PathBuf {
    let cache_dir = dirs::cache_dir()
        .unwrap_or_else(|| PathBuf::from("/tmp"))
        .join("photo-explorer-thumbs");
    fs::create_dir_all(&cache_dir).ok();
    cache_dir
}

fn thumbnail_filename(source_path: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    source_path.hash(&mut hasher);
    format!("{:x}.jpg", hasher.finish())
}

/// Decode a JPEG at reduced resolution using jpeg-decoder's built-in DCT scaling (A2).
/// Returns a DynamicImage at approximately 1/scale of the original dimensions.
fn decode_jpeg_downscaled(path: &Path, target_size: u32) -> Result<DynamicImage, String> {
    let file = fs::File::open(path).map_err(|e| format!("Failed to open: {}", e))?;
    let mut reader = BufReader::new(file);

    // First, peek at the JPEG dimensions without fully decoding
    let mut decoder = jpeg_decoder::Decoder::new(&mut reader);
    decoder
        .read_info()
        .map_err(|e| format!("Failed to read JPEG header: {}", e))?;
    let info = decoder.info().ok_or("No JPEG info")?;

    // Pick a target dimension for downscaled decode.
    // jpeg-decoder's scale() picks the smallest valid IDCT size (1/1, 1/2, 1/4, 1/8)
    // that is at least as large as the requested dimensions.
    // We request our target thumbnail size so it picks the optimal DCT scale.
    let aspect = info.width as f64 / info.height as f64;
    let (req_w, req_h) = if aspect >= 1.0 {
        (target_size as u16, (target_size as f64 / aspect) as u16)
    } else {
        ((target_size as f64 * aspect) as u16, target_size as u16)
    };

    // Re-open and decode with scale
    // (jpeg-decoder needs a fresh reader after read_info consumed some bytes)
    reader
        .seek(SeekFrom::Start(0))
        .map_err(|e| format!("Seek failed: {}", e))?;
    let mut decoder = jpeg_decoder::Decoder::new(&mut reader);
    decoder
        .scale(req_w, req_h)
        .map_err(|e| format!("JPEG scale failed: {}", e))?;
    let pixels = decoder
        .decode()
        .map_err(|e| format!("JPEG decode failed: {}", e))?;
    let info = decoder.info().ok_or("No JPEG info after decode")?;

    let img = match info.pixel_format {
        jpeg_decoder::PixelFormat::RGB24 => {
            let rgb_img = image::RgbImage::from_raw(info.width as u32, info.height as u32, pixels)
                .ok_or("Failed to create RGB image from decoded pixels")?;
            DynamicImage::ImageRgb8(rgb_img)
        }
        jpeg_decoder::PixelFormat::L8 => {
            let gray_img =
                image::GrayImage::from_raw(info.width as u32, info.height as u32, pixels)
                    .ok_or("Failed to create grayscale image from decoded pixels")?;
            DynamicImage::ImageLuma8(gray_img)
        }
        _ => {
            // For CMYK or other formats, fall back to the image crate
            return image::open(path).map_err(|e| format!("Fallback open failed: {}", e));
        }
    };

    Ok(img)
}

// ── Tauri commands ─────────────────────────────────────────────────────────

/// Scan a directory for images, extract EXIF data, and group into bursts.
#[tauri::command]
async fn scan_directory(path: String, threshold_ms: Option<i64>) -> Result<ScanResult, String> {
    let threshold = threshold_ms.unwrap_or(3000);
    let dir_path = Path::new(&path);

    if !dir_path.exists() || !dir_path.is_dir() {
        return Err(format!("Directory not found: {}", path));
    }

    let mut images: Vec<ImageInfo> = Vec::new();

    for entry in WalkDir::new(dir_path)
        .max_depth(1) // Only scan the exact folder, no subdirectories
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let entry_path = entry.path();
        if entry_path.is_file() && is_image_file(entry_path) {
            let path_str = entry_path.to_string_lossy().to_string();
            let filename = entry_path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            let (timestamp, timestamp_str, date_str) = extract_exif_timestamp(entry_path)
                .map(|(ts, s, d)| (Some(ts), Some(s), Some(d)))
                .unwrap_or((None, None, None));

            images.push(ImageInfo {
                path: path_str,
                filename,
                timestamp,
                timestamp_str,
                date_str,
                width: None,
                height: None,
            });
        }
    }

    let total_images = images.len();

    // Sort oldest first (frontend can reverse for newest-first)
    images.sort_by(|a, b| match (&a.timestamp, &b.timestamp) {
        (Some(ta), Some(tb)) => ta.cmp(tb),
        (Some(_), None) => std::cmp::Ordering::Less,
        (None, Some(_)) => std::cmp::Ordering::Greater,
        (None, None) => a.filename.cmp(&b.filename),
    });

    // Group into bursts
    let mut groups: Vec<BurstGroup> = Vec::new();
    let mut current_group: Vec<ImageInfo> = Vec::new();

    for image in images {
        if current_group.is_empty() {
            current_group.push(image);
            continue;
        }

        let should_group = match (
            current_group.last().and_then(|i| i.timestamp),
            image.timestamp,
        ) {
            (Some(prev_ts), Some(curr_ts)) => (curr_ts - prev_ts).abs() <= threshold,
            _ => false,
        };

        if should_group {
            current_group.push(image);
        } else {
            let group_id = groups.len();
            let label = make_group_label(&current_group);
            let date_key = current_group[0].date_str.clone();
            let count = current_group.len();
            groups.push(BurstGroup {
                id: group_id,
                images: current_group,
                label,
                count,
                date_key,
            });
            current_group = vec![image];
        }
    }

    if !current_group.is_empty() {
        let group_id = groups.len();
        let label = make_group_label(&current_group);
        let date_key = current_group[0].date_str.clone();
        let count = current_group.len();
        groups.push(BurstGroup {
            id: group_id,
            images: current_group,
            label,
            count,
            date_key,
        });
    }

    Ok(ScanResult {
        groups,
        total_images,
        directory: path,
    })
}

fn make_group_label(images: &[ImageInfo]) -> String {
    if images.is_empty() {
        return "No images".to_string();
    }

    match &images[0].timestamp_str {
        Some(ts) => {
            if images.len() == 1 {
                ts.clone()
            } else {
                format!("{} ({} photos)", ts, images.len())
            }
        }
        None => format!("{} (no timestamp)", images[0].filename),
    }
}

/// Generate a thumbnail for an image with multiple optimization strategies (A1, A2, A3).
///
/// Strategy order:
/// 1. Return from disk cache if already generated
/// 2. Try extracting the EXIF embedded thumbnail (A1) - near-zero RAM
/// 3. Try downscaled JPEG decode at 1/8 resolution (A2) - low RAM
/// 4. Fall back to full image decode via `image` crate
///
/// Concurrency is limited to 4 simultaneous operations (A3).
#[tauri::command]
async fn generate_thumbnail(source_path: String, size: Option<u32>) -> Result<String, String> {
    let size = size.unwrap_or(300);
    let cache_dir = get_thumbnail_cache_dir();
    let thumb_name = thumbnail_filename(&source_path);
    let thumb_path = cache_dir.join(&thumb_name);

    // 1. Return cached thumbnail if it exists
    if thumb_path.exists() {
        return Ok(thumb_path.to_string_lossy().to_string());
    }

    // Acquire semaphore permit (A3) - blocks if 4 thumbnails are already being generated
    let _permit = THUMBNAIL_SEMAPHORE
        .acquire()
        .await
        .map_err(|e| format!("Semaphore error: {}", e))?;

    // Double-check cache after acquiring permit (another task may have generated it while we waited)
    if thumb_path.exists() {
        return Ok(thumb_path.to_string_lossy().to_string());
    }

    let source = Path::new(&source_path);

    // 2. Try EXIF embedded thumbnail (A1)
    if is_jpeg_file(source) {
        if let Some(thumb_bytes) = extract_exif_thumbnail(source) {
            // Decode the embedded thumbnail to check its size
            if let Ok(thumb_img) = image::load_from_memory(&thumb_bytes) {
                let (tw, th) = (thumb_img.width(), thumb_img.height());
                // If the embedded thumbnail is large enough, resize it to target size and save
                // Even if it's smaller than requested, it's better than decoding the full image
                // for a grid thumbnail - the quality tradeoff is worth the performance gain
                if tw >= 100 && th >= 100 {
                    let resized = thumb_img.resize(size, size, FilterType::Triangle);
                    resized
                        .save(&thumb_path)
                        .map_err(|e| format!("Failed to save EXIF thumbnail: {}", e))?;
                    return Ok(thumb_path.to_string_lossy().to_string());
                }
            } else {
                // The bytes might be a valid JPEG even if image crate can't parse it
                // Try writing the raw bytes directly
                if thumb_bytes.len() > 1000 {
                    if fs::write(&thumb_path, &thumb_bytes).is_ok() {
                        return Ok(thumb_path.to_string_lossy().to_string());
                    }
                }
            }
        }
    }

    // 3. Try downscaled JPEG decode (A2) - much less RAM than full decode
    if is_jpeg_file(source) {
        if let Ok(img) = decode_jpeg_downscaled(source, size) {
            let thumbnail = img.resize(size, size, FilterType::Triangle);
            thumbnail
                .save(&thumb_path)
                .map_err(|e| format!("Failed to save downscaled thumbnail: {}", e))?;
            return Ok(thumb_path.to_string_lossy().to_string());
        }
        // If downscaled decode fails, fall through to full decode
    }

    // 4. Fallback: full image decode via image crate
    let img =
        image::open(&source_path).map_err(|e| format!("Failed to open image: {}", e))?;
    let thumbnail = img.resize(size, size, FilterType::Triangle);
    thumbnail
        .save(&thumb_path)
        .map_err(|e| format!("Failed to save thumbnail: {}", e))?;

    Ok(thumb_path.to_string_lossy().to_string())
}

/// Clear the thumbnail cache and return stats (A4).
#[tauri::command]
async fn clear_thumbnail_cache() -> Result<CacheClearResult, String> {
    let cache_dir = get_thumbnail_cache_dir();
    let mut files_removed: usize = 0;
    let mut bytes_freed: u64 = 0;

    if let Ok(entries) = fs::read_dir(&cache_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.is_file() {
                if let Ok(meta) = path.metadata() {
                    bytes_freed += meta.len();
                }
                if fs::remove_file(&path).is_ok() {
                    files_removed += 1;
                }
            }
        }
    }

    Ok(CacheClearResult {
        files_removed,
        bytes_freed,
    })
}

/// Get the current thumbnail cache size in bytes (A4).
#[tauri::command]
async fn get_cache_size() -> Result<u64, String> {
    let cache_dir = get_thumbnail_cache_dir();
    let mut total: u64 = 0;

    if let Ok(entries) = fs::read_dir(&cache_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            if let Ok(meta) = entry.metadata() {
                if meta.is_file() {
                    total += meta.len();
                }
            }
        }
    }

    Ok(total)
}

// ── Filesystem navigation commands ─────────────────────────────────────────

/// List immediate subdirectories of a given path.
/// Only returns directories (not files) since this is for folder navigation.
/// Hidden folders (starting with '.') are excluded.
#[tauri::command]
async fn list_directory(path: String) -> Result<Vec<DirEntry>, String> {
    let dir_path = Path::new(&path);

    if !dir_path.exists() || !dir_path.is_dir() {
        return Err(format!("Directory not found: {}", path));
    }

    let mut entries: Vec<DirEntry> = Vec::new();

    let read_dir = fs::read_dir(dir_path).map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in read_dir.filter_map(|e| e.ok()) {
        let entry_path = entry.path();
        let name = entry
            .file_name()
            .to_string_lossy()
            .to_string();

        // Skip hidden files/folders
        if name.starts_with('.') {
            continue;
        }

        if entry_path.is_dir() {
            // Quick check if this directory has any subdirectories
            let has_children = fs::read_dir(&entry_path)
                .map(|rd| {
                    rd.filter_map(|e| e.ok())
                        .any(|e| {
                            let n = e.file_name().to_string_lossy().to_string();
                            !n.starts_with('.') && e.path().is_dir()
                        })
                })
                .unwrap_or(false);

            entries.push(DirEntry {
                name,
                path: entry_path.to_string_lossy().to_string(),
                is_dir: true,
                has_children,
            });
        }
    }

    // Sort alphabetically, case-insensitive
    entries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    Ok(entries)
}

/// Get the user's home directory path.
#[tauri::command]
async fn get_home_dir() -> Result<String, String> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Could not determine home directory".to_string())
}

/// List mounted volumes from /Volumes/.
/// Filters out hidden system volumes.
#[tauri::command]
async fn list_volumes() -> Result<Vec<VolumeInfo>, String> {
    let volumes_path = Path::new("/Volumes");
    if !volumes_path.exists() {
        return Ok(Vec::new());
    }

    let mut volumes: Vec<VolumeInfo> = Vec::new();

    if let Ok(entries) = fs::read_dir(volumes_path) {
        for entry in entries.filter_map(|e| e.ok()) {
            let name = entry.file_name().to_string_lossy().to_string();
            let path = entry.path().to_string_lossy().to_string();

            // Skip hidden entries
            if name.starts_with('.') {
                continue;
            }

            volumes.push(VolumeInfo { name, path });
        }
    }

    volumes.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(volumes)
}

/// Check if a volume at the given path is an external/removable device
/// by inspecting `diskutil info -plist <path>` output.
fn is_external_volume(path: &str) -> bool {
    let output = std::process::Command::new("diskutil")
        .args(["info", "-plist", path])
        .output();

    let output = match output {
        Ok(o) if o.status.success() => o.stdout,
        _ => return false,
    };

    let plist = String::from_utf8_lossy(&output);

    // Helper: extract the boolean value following a given key in the plist XML.
    // Apple's plist format is: <key>Name</key>\n<true/> or <false/>
    let has_true_key = |key: &str| -> bool {
        if let Some(pos) = plist.find(&format!("<key>{}</key>", key)) {
            let after = &plist[pos..];
            // Look at the next <true/> or <false/> tag after the key
            let true_pos = after.find("<true/>");
            let false_pos = after.find("<false/>");
            match (true_pos, false_pos) {
                (Some(t), Some(f)) => t < f,
                (Some(_), None) => true,
                _ => false,
            }
        } else {
            false
        }
    };

    // A volume is external if it's ejectable or has removable media
    has_true_key("Ejectable") || has_true_key("RemovableMedia")
}

/// List external devices (USBs, SD cards, external drives) from /Volumes/.
#[tauri::command]
async fn list_external_devices() -> Result<Vec<VolumeInfo>, String> {
    let volumes_path = Path::new("/Volumes");
    if !volumes_path.exists() {
        return Ok(Vec::new());
    }

    let mut devices: Vec<VolumeInfo> = Vec::new();

    if let Ok(entries) = fs::read_dir(volumes_path) {
        for entry in entries.filter_map(|e| e.ok()) {
            let name = entry.file_name().to_string_lossy().to_string();
            let path = entry.path().to_string_lossy().to_string();

            if name.starts_with('.') {
                continue;
            }

            if is_external_volume(&path) {
                devices.push(VolumeInfo { name, path });
            }
        }
    }

    devices.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(devices)
}

/// Get the path to the favourites JSON file in the app data directory.
fn get_favourites_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    fs::create_dir_all(&app_data).map_err(|e| format!("Failed to create app data dir: {}", e))?;
    Ok(app_data.join("favourites.json"))
}

/// Load favourite folders from persistent storage.
#[tauri::command]
async fn load_favourites(app_handle: tauri::AppHandle) -> Result<Vec<FavouriteFolder>, String> {
    let fav_path = get_favourites_path(&app_handle)?;

    if !fav_path.exists() {
        return Ok(Vec::new());
    }

    let content =
        fs::read_to_string(&fav_path).map_err(|e| format!("Failed to read favourites: {}", e))?;

    let paths: Vec<String> =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse favourites: {}", e))?;

    let favourites = paths
        .into_iter()
        .map(|p| {
            let path_obj = Path::new(&p);
            let name = path_obj
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| p.clone());
            let exists = path_obj.exists();
            FavouriteFolder {
                name,
                path: p,
                exists,
            }
        })
        .collect();

    Ok(favourites)
}

/// Save favourite folder paths to persistent storage.
#[tauri::command]
async fn save_favourites(
    app_handle: tauri::AppHandle,
    paths: Vec<String>,
) -> Result<(), String> {
    let fav_path = get_favourites_path(&app_handle)?;
    let content =
        serde_json::to_string_pretty(&paths).map_err(|e| format!("Failed to serialize: {}", e))?;
    fs::write(&fav_path, content).map_err(|e| format!("Failed to write favourites: {}", e))?;
    Ok(())
}

// ── Favourite photos persistence ───────────────────────────────────────────

/// Get the path to the favourite photos JSON file in the app data directory.
fn get_favourite_photos_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    fs::create_dir_all(&app_data).map_err(|e| format!("Failed to create app data dir: {}", e))?;
    Ok(app_data.join("favourite_photos.json"))
}

/// Load favourite photos from persistent storage.
#[tauri::command]
async fn load_favourite_photos(
    app_handle: tauri::AppHandle,
) -> Result<Vec<FavouritePhoto>, String> {
    let fav_path = get_favourite_photos_path(&app_handle)?;

    if !fav_path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&fav_path)
        .map_err(|e| format!("Failed to read favourite photos: {}", e))?;

    let favourites: Vec<FavouritePhoto> = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse favourite photos: {}", e))?;

    Ok(favourites)
}

/// Save favourite photos to persistent storage.
#[tauri::command]
async fn save_favourite_photos(
    app_handle: tauri::AppHandle,
    favourites: Vec<FavouritePhoto>,
) -> Result<(), String> {
    let fav_path = get_favourite_photos_path(&app_handle)?;
    let content = serde_json::to_string_pretty(&favourites)
        .map_err(|e| format!("Failed to serialize favourite photos: {}", e))?;
    fs::write(&fav_path, content)
        .map_err(|e| format!("Failed to write favourite photos: {}", e))?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_drag::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            scan_directory,
            generate_thumbnail,
            clear_thumbnail_cache,
            get_cache_size,
            list_directory,
            get_home_dir,
            list_volumes,
            list_external_devices,
            load_favourites,
            save_favourites,
            load_favourite_photos,
            save_favourite_photos,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
