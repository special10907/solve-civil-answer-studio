Usage notes for helper scripts

- `copy_from_goodnotes.ps1`
  - Purpose: copy PDF files from your GoodNotes folder (H:) into this project's folder so the web UI can open and process them.
  - Default source: `H:\내 드라이브\GoodNotes\토목구조기술사 기출문제`
  - Default destination: the project root (this folder).
  - Examples:

```powershell
# copy PDFs and open the web UI
.\tools\copy_from_goodnotes.ps1 -OpenHtml

# only copy PDFs (do not open UI)
.\tools\copy_from_goodnotes.ps1
```

After copying, open `solve_120.html` in your browser (or use `-OpenHtml`) and use the OCR section's file picker or the newly-copied PDFs.
