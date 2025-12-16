import React, { useState, useEffect } from "react";

interface File {
	id: string;
	name: string;
}

const FileSelector: React.FC<{ onSelect: (file: File) => void }> = ({
	onSelect,
}) => {
	const [files, setFiles] = useState<File[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		// Fetch the list of files from the backend
		const fetchFiles = async () => {
			try {
				const response = await fetch("/api/editor/files");
				const data = await response.json();
				setFiles(data.files);
			} catch (error) {
				console.error("Error fetching files:", error);
			} finally {
				setLoading(false);
			}
		};

		fetchFiles();
	}, []);

	if (loading) {
		return <div>Loading files...</div>;
	}

	return (
		<div className='file-selector'>
			<h3>Select a file to edit:</h3>
			<ul>
				{files.map((file) => (
					<li key={file.id}>
						<button onClick={() => onSelect(file)}>{file.name}</button>
					</li>
				))}
			</ul>
		</div>
	);
};

export default FileSelector;
