# CKEditor Integration

This folder contains the CKEditor 5 integration for the application.

## Files

- `CKEditorWrapper.tsx`: React component wrapping CKEditor 5.
- `editor.config.ts`: Configuration for CKEditor 5.
- `styles.css`: Styles for the editor.
- `autosave.ts`: Autosave logic (to be implemented).
- `diff.ts`: Diff calculation logic (to be implemented).

## Setup

1. Install CKEditor dependencies:

   ```bash
   npm install @ckeditor/ckeditor5-react @ckeditor/ckeditor5-build-decoupled-document
   ```

2. Import and use `CKEditorWrapper` in your application.
