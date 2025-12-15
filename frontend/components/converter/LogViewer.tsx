"use client";

import { ConversionLog } from "@/lib/converter/types/converter-types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	Trash2,
	Info,
	CheckCircle,
	XCircle,
	AlertTriangle,
} from "lucide-react";
import { useEffect, useRef } from "react";

interface LogViewerProps {
	logs: ConversionLog[];
	onClear: () => void;
}

export function LogViewer({ logs, onClear }: LogViewerProps) {
	const logContainerRef = useRef<HTMLDivElement>(null);

	// Auto-scroll to top when new logs arrive
	useEffect(() => {
		if (logContainerRef.current) {
			logContainerRef.current.scrollTop = 0;
		}
	}, [logs]);

	const getLogIcon = (level: ConversionLog["level"]) => {
		switch (level) {
			case "info":
				return <Info className='h-4 w-4 text-blue-600' />;
			case "success":
				return <CheckCircle className='h-4 w-4 text-green-600' />;
			case "error":
				return <XCircle className='h-4 w-4 text-red-600' />;
			case "warning":
				return <AlertTriangle className='h-4 w-4 text-yellow-600' />;
		}
	};

	const getLogBadge = (level: ConversionLog["level"]) => {
		switch (level) {
			case "info":
				return (
					<Badge variant='outline' className='text-xs'>
						INFO
					</Badge>
				);
			case "success":
				return <Badge className='bg-green-600 text-xs'>SUCCESS</Badge>;
			case "error":
				return (
					<Badge variant='destructive' className='text-xs'>
						ERROR
					</Badge>
				);
			case "warning":
				return <Badge className='bg-yellow-600 text-xs'>WARNING</Badge>;
		}
	};

	const formatTime = (date: Date) => {
		return new Date(date).toLocaleTimeString("en-US", {
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
			hour12: false,
		});
	};

	return (
		<Card className='p-6'>
			<div className='space-y-4'>
				<div className='flex items-center justify-between'>
					<h3 className='text-lg font-semibold'>Activity Logs</h3>
					<Button
						variant='outline'
						size='sm'
						onClick={onClear}
						disabled={logs.length === 0}>
						<Trash2 className='h-4 w-4 mr-2' />
						Clear Logs
					</Button>
				</div>

				<div
					ref={logContainerRef}
					className='space-y-2 max-h-96 overflow-y-auto font-mono text-sm'>
					{logs.length === 0 ? (
						<div className='text-center text-muted-foreground py-8'>
							No logs yet. Start converting files to see activity.
						</div>
					) : (
						logs.map((log) => (
							<div
								key={log.id}
								className={`flex items-start gap-3 p-2 rounded border-l-2 ${
									log.level === "error"
										? "border-red-600 bg-red-50/50"
										: log.level === "success"
										? "border-green-600 bg-green-50/50"
										: log.level === "warning"
										? "border-yellow-600 bg-yellow-50/50"
										: "border-blue-600 bg-blue-50/50"
								}`}>
								<div className='mt-0.5'>{getLogIcon(log.level)}</div>
								<div className='flex-1 min-w-0'>
									<div className='flex items-center gap-2 mb-1'>
										<span className='text-xs text-muted-foreground'>
											{formatTime(log.timestamp)}
										</span>
										{getLogBadge(log.level)}
									</div>
									<div className='text-sm break-words'>{log.message}</div>
								</div>
							</div>
						))
					)}
				</div>

				{logs.length > 0 && (
					<div className='pt-2 border-t text-xs text-muted-foreground'>
						Showing {logs.length} log{logs.length !== 1 ? "s" : ""} (latest
						first)
					</div>
				)}
			</div>
		</Card>
	);
}
