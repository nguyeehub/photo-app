use image::imageops::FilterType;
use image::GenericImageView;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::BufReader;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageInfo {
    pub path: String,
    pub filename: String,
    /// Unix timestamp in milliseconds from EXIF DateTimeOriginal
    pub timestamp: Option<i64>,
    /// Human-readable timestamp string
    pub timestamp_str: Option<String>,
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub groups: Vec<BurstGroup>,
    pub total_images: usize,
    pub directory: String,
}

/// Check if a file extension is a supported image format
fn is_image_file(path: &Path) -> bool {
    match path.extension().and_then(|e| e.to_str()) {
        Some(ext) => matches!(
            ext.to_lowercase().as_str(),
            "jpg" | "jpeg" | "png" | "gif" | "bmp" | "webp" | "tiff" | "tif"
        ),
        None => false,
    }
}

/// Extract EXIF DateTimeOriginal from a JPEG file
fn extract_exif_timestamp(path: &Path) -> Option<(i64, String)> {
    let file = fs::File::open(path).ok()?;
    let mut reader = BufReader::new(file);
    let exif_reader = exif::Reader::new();
    let exif = exif_reader.read_from_container(&mut reader).ok()?;

    // Try DateTimeOriginal first, then DateTimeDigitized, then DateTime
    let field = exif
        .get_field(exif::Tag::DateTimeOriginal, exif::In::PRIMARY)
        .or_else(|| exif.get_field(exif::Tag::DateTimeDigitized, exif::In::PRIMARY))
        .or_else(|| exif.get_field(exif::Tag::DateTime, exif::In::PRIMARY))?;

    let datetime_str = field.display_value().to_string();

    // EXIF datetime format: "2024:01:15 14:30:45"
    // Parse to unix timestamp
    let ts = parse_exif_datetime(&datetime_str)?;
    Some((ts, datetime_str))
}

/// Parse EXIF datetime string "YYYY:MM:DD HH:MM:SS" to unix timestamp in milliseconds
fn parse_exif_datetime(s: &str) -> Option<i64> {
    // Format: "2024:01:15 14:30:45" or "2024-01-15 14:30:45"
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

    // Simple conversion to unix timestamp (not accounting for timezone, good enough for grouping)
    // Days from year 0 to 1970
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
    Some(timestamp_secs * 1000) // Convert to milliseconds
}

fn is_leap_year(year: i32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)
}

/// Get the thumbnail cache directory
fn get_thumbnail_cache_dir() -> PathBuf {
    let cache_dir = dirs::cache_dir()
        .unwrap_or_else(|| PathBuf::from("/tmp"))
        .join("photo-explorer-thumbs");
    fs::create_dir_all(&cache_dir).ok();
    cache_dir
}

/// Generate a deterministic thumbnail filename from the source path
fn thumbnail_filename(source_path: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    source_path.hash(&mut hasher);
    format!("{:x}.jpg", hasher.finish())
}

/// Scan a directory for images, extract EXIF data, and group into bursts
#[tauri::command]
async fn scan_directory(path: String, threshold_ms: Option<i64>) -> Result<ScanResult, String> {
    let threshold = threshold_ms.unwrap_or(3000); // Default 3 seconds
    let dir_path = Path::new(&path);

    if !dir_path.exists() || !dir_path.is_dir() {
        return Err(format!("Directory not found: {}", path));
    }

    // Collect all image files
    let mut images: Vec<ImageInfo> = Vec::new();

    for entry in WalkDir::new(dir_path)
        .max_depth(3) // Don't go too deep
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

            let (timestamp, timestamp_str) = extract_exif_timestamp(entry_path)
                .map(|(ts, s)| (Some(ts), Some(s)))
                .unwrap_or((None, None));

            images.push(ImageInfo {
                path: path_str,
                filename,
                timestamp,
                timestamp_str,
                width: None,
                height: None,
            });
        }
    }

    let total_images = images.len();

    // Sort by timestamp (images without timestamps go to the end)
    images.sort_by(|a, b| {
        match (&a.timestamp, &b.timestamp) {
            (Some(ta), Some(tb)) => ta.cmp(tb),
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            (None, None) => a.filename.cmp(&b.filename), // Sort by name if no timestamp
        }
    });

    // Group into bursts based on time threshold
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
            _ => false, // Don't group images without timestamps together
        };

        if should_group {
            current_group.push(image);
        } else {
            // Finish current group
            let group_id = groups.len();
            let label = make_group_label(&current_group);
            let count = current_group.len();
            groups.push(BurstGroup {
                id: group_id,
                images: current_group,
                label,
                count,
            });
            current_group = vec![image];
        }
    }

    // Don't forget the last group
    if !current_group.is_empty() {
        let group_id = groups.len();
        let label = make_group_label(&current_group);
        let count = current_group.len();
        groups.push(BurstGroup {
            id: group_id,
            images: current_group,
            label,
            count,
        });
    }

    Ok(ScanResult {
        groups,
        total_images,
        directory: path,
    })
}

/// Create a human-readable label for a burst group
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

/// Generate a thumbnail for an image, caching it on disk
#[tauri::command]
async fn generate_thumbnail(source_path: String, size: Option<u32>) -> Result<String, String> {
    let size = size.unwrap_or(300);
    let cache_dir = get_thumbnail_cache_dir();
    let thumb_name = thumbnail_filename(&source_path);
    let thumb_path = cache_dir.join(&thumb_name);

    // Return cached thumbnail if it exists
    if thumb_path.exists() {
        return Ok(thumb_path.to_string_lossy().to_string());
    }

    // Generate thumbnail
    let img = image::open(&source_path).map_err(|e| format!("Failed to open image: {}", e))?;

    let thumbnail = img.resize(size, size, FilterType::Triangle);

    thumbnail
        .save(&thumb_path)
        .map_err(|e| format!("Failed to save thumbnail: {}", e))?;

    Ok(thumb_path.to_string_lossy().to_string())
}

/// Get image dimensions without loading the full image
#[tauri::command]
async fn get_image_dimensions(path: String) -> Result<(u32, u32), String> {
    let img = image::open(&path).map_err(|e| format!("Failed to open image: {}", e))?;
    Ok(img.dimensions())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            scan_directory,
            generate_thumbnail,
            get_image_dimensions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
