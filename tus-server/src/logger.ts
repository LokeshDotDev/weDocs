/* Simple console-backed logger with leveled methods */
export const logger = {
	info: (msg: string, meta?: Record<string, unknown>) => {
		const timestamp = new Date().toISOString();
		console.log(`[${timestamp}] [INFO] ${msg}`, meta ? JSON.stringify(meta, null, 2) : "");
	},
	warn: (msg: string, meta?: Record<string, unknown>) => {
		const timestamp = new Date().toISOString();
		console.warn(`[${timestamp}] [WARN] ${msg}`, meta ? JSON.stringify(meta, null, 2) : "");
	},
	error: (msg: string, meta?: Record<string, unknown>) => {
		const timestamp = new Date().toISOString();
		console.error(`[${timestamp}] [ERROR] ${msg}`, meta ? JSON.stringify(meta, null, 2) : "");
	},
};
