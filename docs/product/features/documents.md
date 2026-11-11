# Documents

Certificates, medical findings, receipts and scans about the child (`src/components/Dokumenti.svelte`; the rules
in `src/lib/dokumenti.ts`).

- Either parent adds a document: on a phone by taking a photo or picking a file, on a computer also by dragging
  it in. Categories: school, health, activities outside school, personal documents, legal and agreements,
  receipts, other. Accepted files: PDF, JPEG, PNG and WebP, up to 10 MB.
- Photos are redrawn in the browser before upload. That shrinks them and drops the location, time and device a
  phone writes into them; HEIC becomes JPEG where the browser can read it (`src/lib/slike.ts`).
- A file never changes after upload: the bucket has no update policy.
- Deleting moves a document to the trash (Obrisani). Both parents see who did it, and either can restore it.
  Every step is kept in the document's trail.
- Deleting for good happens only from the trash, and only when both parents agree: one proposes, the other
  confirms or declines, and the proposer can withdraw. Only then does the bucket allow the file to be removed,
  and the row goes once the file is gone. A short record stays (what, who proposed, who confirmed, when).
- A document opens through a signed link valid for 10 minutes. There are no public links.
- In the demo, documents live in the browser's IndexedDB, with example documents drawn in the browser, so the
  repository holds no real scans.

Storage and database: the private bucket `dokumenti`, with each file under `<family>/<document>.<ext>`; tables
`dokument`, `dokument_trag` and `dokument_brisanje`; functions `dodaj_dokument`, `izmeni_dokument`,
`obrisi_dokument`, `vrati_dokument`, `predlozi_trajno_brisanje`, `potvrdi_trajno_brisanje`,
`odbij_trajno_brisanje`, `povuci_trajno_brisanje` and `zavrsi_trajno_brisanje`.
