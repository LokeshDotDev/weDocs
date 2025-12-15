"use client";

import { MinIOFile } from "@/lib/converter/types/converter-types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

interface FileListProps {
	files: MinIOFile[];
	selectedFiles: Set<string>;
	onToggleSelection: (fileKey: string) => void;
	onSelectAll: () => void;
	onDeselectAll: () => void;
	isLoading: boolean;
	disabled?: boolean;
}

export function FileList({
	files,
	selectedFiles,
	onToggleSelection,
	onSelectAll,
	onDeselectAll,
	isLoading,
	disabled = false,
}: FileListProps) {
	const formatFileSize = (bytes: number) => {
		if (bytes === 0) return "0 Bytes";
		const k = 1024;
		const sizes = ["Bytes", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
	};

	const formatDate = (date: Date) => {
		return new Date(date).toLocaleString();
	};

	if (isLoading) {
		return (
			<Card className='p-6'>
				<div className='text-center text-muted-foreground'>
					Loading files...
				</div>
			</Card>
		);
	}

	if (files.length === 0) {
		return (
			<Card className='p-6'>
				<div className='text-center text-muted-foreground'>
					No PDF files found. Upload some files first.
				</div>
			</Card>
		);
	}

	return (
		<Card className='p-6'>
			<div className='space-y-4'>
				<div className='flex items-center justify-between'>
					<h3 className='text-lg font-semibold'>
						Available PDF Files
						<Badge variant='secondary' className='ml-2'>
							{files.length}
						</Badge>
					</h3>
					<div className='flex gap-2'>
						<Button
							variant='outline'
							size='sm'
							onClick={onSelectAll}
							disabled={disabled || files.length === 0}>
							Select All
						</Button>
						<Button
							variant='outline'
							size='sm'
							onClick={onDeselectAll}
							disabled={disabled || selectedFiles.size === 0}>
							Deselect All
						</Button>
					</div>
				</div>

				<div className='space-y-2 max-h-96 overflow-y-auto'>
					{files.map((file) => (
						<div
							key={file.key}
							className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
								selectedFiles.has(file.key)
									? "bg-primary/5 border-primary"
									: "hover:bg-muted/50"
							}`}>
							<Checkbox
								checked={selectedFiles.has(file.key)}
								onCheckedChange={() => onToggleSelection(file.key)}
								disabled={disabled}
							/>
							<div className='flex-1 min-w-0'>
								<div className='font-medium truncate'>{file.name}</div>
								<div className='text-sm text-muted-foreground'>
									{formatFileSize(file.size)} • {formatDate(file.lastModified)}
								</div>
								<div className='text-xs text-muted-foreground truncate'>
									{file.relativePath}
								</div>
							</div>
							<Badge variant='outline'>{file.stage}</Badge>
						</div>
					))}
				</div>

				{selectedFiles.size > 0 && (
					<div className='pt-2 border-t'>
						<div className='text-sm text-muted-foreground'>
							{selectedFiles.size} file{selectedFiles.size !== 1 ? "s" : ""}{" "}
							selected
						</div>
					</div>
				)}
			</div>
		</Card>
	);
}
