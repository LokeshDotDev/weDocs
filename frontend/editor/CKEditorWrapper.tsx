import React, { useRef, useEffect } from "react";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import DecoupledEditor from "@ckeditor/ckeditor5-build-decoupled-document";
import "./styles.css";
import autosave from "./autosave";
import { Editor } from "@ckeditor/ckeditor5-core";

interface CKEditorWrapperProps {
	data: string;
	onChange: (html: string) => void;
	onSave: () => void;
	onComplete: () => void;
	fileId: string;
}

const CKEditorWrapper: React.FC<CKEditorWrapperProps> = ({
	data,
	onChange,
	onSave,
	onComplete,
	fileId,
}) => {
	const editorRef = useRef<Editor | null>(null);

	const handleReady = (editor: Editor) => {
		editorRef.current = editor;
		const toolbar = editor.ui?.view?.toolbar?.element;
		const toolbarContainer = document.querySelector("#toolbar-container");
		if (toolbar && toolbarContainer) {
			toolbarContainer.appendChild(toolbar);
		}
	};

	useEffect(() => {
		if (editorRef.current) {
			autosave(editorRef.current, async (html: string) => {
				await fetch(`/api/editor/${fileId}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ html }),
				});
			});
		}
	}, [editorRef, fileId]);

	return (
		<div className='editor-container'>
			<div id='toolbar-container'></div>
			<CKEditor
				editor={DecoupledEditor}
				data={data}
				onReady={handleReady}
				onChange={(event: Event, editor: Editor) => {
					const html = editor.getData();
					onChange(html);
				}}
			/>
			<button onClick={onSave} className='save-button'>
				Save
			</button>
			<button onClick={onComplete} className='complete-button'>
				Complete Editing
			</button>
		</div>
	);
};

export default CKEditorWrapper;
