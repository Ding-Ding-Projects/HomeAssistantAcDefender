namespace HomeAssistantAcDefender.Models;

public sealed record LocalToolAdapter(string Id, string Category, string Name, string Cantonese, string Detail, string CantoneseDetail, string? Requirement = null)
{
    public static readonly string[] Categories = ["Documents/PDF", "Images", "Audio", "Video", "Archives", "Structured Data/Spreadsheets", "Code/Text", "Binary Encodings"];
    public static readonly LocalToolAdapter[] Catalog =
    [
        new("pdf", "Documents/PDF", "PDF tools / Office documents", "PDF 工具／Office 文件", "Unavailable: no bundled isolated PDF or Office document runtime.", "未提供：未附設隔離式 PDF 或 Office 文件轉換引擎。", "unavailable"),
        new("png", "Images", "PNG", "PNG", "Lossless raster output; strips source metadata and color profile. Animation is refused.", "無損點陣輸出；移除來源中繼資料及色彩描述檔，唔接受動畫。", "images"),
        new("jpeg", "Images", "JPEG", "JPEG", "Lossy quality 90%; transparency becomes white. Metadata and color profile are stripped.", "有損畫質 90%；透明位置變白，移除中繼資料及色彩描述檔。", "images"),
        new("webp", "Images", "WebP", "WebP", "Lossy quality 90%; metadata stripped. Browser encoder must support WebP.", "有損畫質 90%；移除中繼資料，須瀏覽器支援 WebP 編碼。", "images"),
        new("audio", "Audio", "MP3 / WAV / FLAC / AAC", "MP3 / WAV / FLAC / AAC", "Unavailable: no bundled isolated audio transcoder.", "未提供：未附設隔離式音訊轉碼器。", "unavailable"),
        new("video", "Video", "MP4 / WebM / MOV", "MP4 / WebM / MOV", "Unavailable: no bundled isolated video transcoder.", "未提供：未附設隔離式影片轉碼器。", "unavailable"),
        new("gzip", "Archives", "Compress to gzip", "壓縮成 gzip", "One byte stream; preserves source bytes, not original filename metadata. 8 MiB output limit.", "單一資料串流；保留原始位元組，唔保留檔名中繼資料。輸出上限 8 MiB。", "gzip"),
        new("gunzip", "Archives", "Decompress gzip", "解壓 gzip", "Signature-verified gzip only; aborts above 8 MiB expanded bytes. Downloads as .bin.", "只接受經簽章驗證嘅 gzip；解壓超過 8 MiB 即停止，下載為 .bin。", "gzip"),
        new("zip", "Archives", "ZIP / 7z / RAR / TAR", "ZIP / 7z / RAR / TAR", "Unavailable: no bundled sandboxed archive extractor. Archive entries are never opened.", "未提供：未附設沙盒解壓器，唔會開啟壓縮檔內嘅內容。", "unavailable"),
        new("json", "Structured Data/Spreadsheets", "Format JSON", "整理 JSON", "Valid JSON up to 512 KiB and 64 nesting levels. Indentation changes; duplicate object keys and numeric precision can be lost.", "只接受最多 512 KiB、64 層嘅有效 JSON。調整縮排；重複鍵及數字精確度可能流失。"),
        new("jsoncsv", "Structured Data/Spreadsheets", "JSON array to CSV", "JSON 陣列轉 CSV", "JSON input up to 512 KiB; flat object rows only; rejects formula-like cells and nested data. Types and null distinctions are lost.", "JSON 輸入最多 512 KiB，只接受平面物件列；拒絕似公式嘅儲存格及巢狀資料。類型及 null 區別會流失。"),
        new("xlsx", "Structured Data/Spreadsheets", "XLSX / ODS", "XLSX / ODS", "Unavailable: no bundled spreadsheet runtime.", "未提供：未附設試算表轉換引擎。", "unavailable"),
        new("utf8", "Code/Text", "Text to UTF-8", "文字轉 UTF-8", "Strict decoding with chosen source encoding; output UTF-8 without BOM.", "按所選來源編碼嚴格解碼；輸出 UTF-8，唔含 BOM。"),
        new("lf", "Code/Text", "Normalize LF", "統一 LF 換行", "Changes line endings; output UTF-8 without BOM.", "更改換行方式；輸出 UTF-8，唔含 BOM。"),
        new("crlf", "Code/Text", "Normalize CRLF", "統一 CRLF 換行", "Changes line endings; output UTF-8 without BOM.", "更改換行方式；輸出 UTF-8，唔含 BOM。"),
        new("html", "Code/Text", "HTML to text", "HTML 轉純文字", "Unavailable: no isolated inert HTML parser bundled. Uploaded markup is never rendered.", "未提供：未附設隔離式靜態 HTML 解析器，唔會顯示上載標記。", "unavailable"),
        new("base64", "Binary Encodings", "Bytes to base64", "位元組轉 base64", "Exact bytes encoded as canonical base64; output may exceed input size by one third." ,"精確轉為標準 base64；輸出大小可能增加三分之一。"),
        new("unbase64", "Binary Encodings", "Base64 to bytes", "Base64 轉位元組", "Strict canonical base64; whitespace accepted. Downloads as .bin.", "嚴格驗證標準 base64，可含空白；下載為 .bin。"),
        new("hex", "Binary Encodings", "Bytes to hex", "位元組轉十六進制", "Exact bytes as hexadecimal; input limited to 4 MiB to bound output.", "精確轉為十六進制；輸入限 4 MiB 以控制輸出大小。"),
        new("unhex", "Binary Encodings", "Hex to bytes", "十六進制轉位元組", "Strict pairs of hex digits; whitespace accepted. Downloads as .bin.", "嚴格驗證十六進制數字對，可含空白；下載為 .bin。")
    ];
}
