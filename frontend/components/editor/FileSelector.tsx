"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface UserItem {
	id: string;
}
interface UploadItem {
	id: string;
}
interface FormattedFile {
	key: string;
	name: string;
}

interface FileSelectorProps {
	selectedFile: string | null;
	onFileSelect: (fileKey: string, fileName: string) => void;
}

export function FileSelector({
	selectedFile,
	onFileSelect,
}: FileSelectorProps) {
	const [users, setUsers] = useState<UserItem[]>([]);
	const [uploads, setUploads] = useState<UploadItem[]>([]);
	const [files, setFiles] = useState<FormattedFile[]>([]);
	const [selectedUser, setSelectedUser] = useState<string | null>(null);
	const [selectedUpload, setSelectedUpload] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Load users on mount
	useEffect(() => {
		const loadUsers = async () => {
			try {
				setIsLoading(true);
				const response = await fetch("/api/editor/users");
				if (!response.ok) throw new Error("Failed to load users");
				const data = await response.json();
				setUsers(data.users ?? data);
				setError(null);
			} catch (err) {
				console.error("Error loading users:", err);
				setError("Failed to load users");
				setUsers([]);
			} finally {
				setIsLoading(false);
			}
		};
		loadUsers();
	}, []);

	const selectUser = async (userId: string) => {
		try {
			setSelectedUser(userId);
			setSelectedUpload(null);
			setFiles([]);
			setIsLoading(true);
			const response = await fetch(
				`/api/editor/uploads?userId=${encodeURIComponent(userId)}`
			);
			if (!response.ok) throw new Error("Failed to load uploads");
			const data = await response.json();
			setUploads(data.uploads ?? data);
			setError(null);
		} catch (err) {
			console.error("Error loading uploads:", err);
			setError("Failed to load uploads");
			setUploads([]);
		} finally {
			setIsLoading(false);
		}
	};

	const selectUpload = async (uploadId: string) => {
		if (!selectedUser) return;
		try {
			setSelectedUpload(uploadId);
			setIsLoading(true);
			const response = await fetch(
				`/api/editor/files?userId=${encodeURIComponent(
					selectedUser
				)}&uploadId=${encodeURIComponent(uploadId)}`
			);
			if (!response.ok) throw new Error("Failed to load files");
			const data = await response.json();
			setFiles(data.files ?? data);
			setError(null);
		} catch (err) {
			console.error("Error loading files:", err);
			setError("Failed to load files");
			setFiles([]);
		} finally {
			setIsLoading(false);
		}
	};

	const handleSelectFile = (file: FormattedFile) => {
		// For DOCX files, we just pass the key and name - ONLYOFFICE will load it directly
		onFileSelect(file.key, file.name);
	};

	return (
		<div className='space-y-4'>
			{/* Users */}
			<div>
				<div className='text-sm font-semibold mb-2'>Users</div>
				{isLoading && users.length === 0 ? (
					<div className='flex items-center justify-center py-4'>
						<Loader2 className='w-5 h-5 animate-spin' />
					</div>
				) : users.length === 0 ? (
					<div className='text-sm text-muted-foreground'>No users found</div>
				) : (
					<div className='space-y-2'>
						{users.map((u) => (
							<Button
								key={u.id}
								variant={selectedUser === u.id ? "default" : "outline"}
								className='w-full justify-start'
								onClick={() => selectUser(u.id)}>
								{u.id}
							</Button>
						))}
					</div>
				)}
			</div>

			{/* Uploads */}
			<div>
				<div className='text-sm font-semibold mb-2'>Uploads</div>
				{!selectedUser ? (
					<div className='text-sm text-muted-foreground'>
						Select a user to view uploads
					</div>
				) : isLoading && uploads.length === 0 ? (
					<div className='flex items-center justify-center py-4'>
						<Loader2 className='w-5 h-5 animate-spin' />
					</div>
				) : uploads.length === 0 ? (
					<div className='text-sm text-muted-foreground'>No uploads found</div>
				) : (
					<div className='space-y-2'>
						{uploads.map((u) => (
							<Button
								key={u.id}
								variant={selectedUpload === u.id ? "default" : "outline"}
								className='w-full justify-start'
								onClick={() => selectUpload(u.id)}>
								{u.id}
							</Button>
						))}
					</div>
				)}
			</div>

			{/* Files */}
			<div>
				<div className='text-sm font-semibold mb-2'>Formatted Files</div>
				{!selectedUpload ? (
					<div className='text-sm text-muted-foreground'>
						Select an upload to view files
					</div>
				) : isLoading && files.length === 0 ? (
					<div className='flex items-center justify-center py-4'>
						<Loader2 className='w-5 h-5 animate-spin' />
					</div>
				) : files.length === 0 ? (
					<div className='text-sm text-muted-foreground'>No files found</div>
				) : (
					<div className='space-y-2'>
						{files.map((f) => (
							<Button
								key={f.key}
								variant={selectedFile === f.key ? "default" : "outline"}
								className='w-full justify-start text-left'
								onClick={() => handleSelectFile(f)}>
								<div className='truncate'>
									<div className='font-medium truncate'>{f.name}</div>
									<div className='text-xs opacity-70 truncate'>{f.key}</div>
								</div>
							</Button>
						))}
					</div>
				)}
			</div>

			{error && (
				<div className='text-xs text-red-600 bg-red-50 p-2 rounded'>
					{error}
				</div>
			)}
		</div>
	);
}
