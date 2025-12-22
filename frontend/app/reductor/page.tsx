"use client";
import { useEffect, useState } from "react";

interface MinioFile {
  name: string;
  key: string;
  size: number;
  lastModified: string;
}

export default function ReductorPage() {
  const [files, setFiles] = useState<MinioFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Map<string, any>>(new Map());

  // Fetch DOCX files from MinIO
  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const resp = await fetch("/api/reductor/files");
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        setFiles(data.files || []);
      } catch (err: any) {
        setError(err.message || "Failed to fetch files");
      } finally {
        setLoading(false);
      }
    };
    fetchFiles();
  }, []);

  const onAnonymize = async (fileKey: string) => {
    setProcessing(fileKey);
    setError(null);
    try {
      const resp = await fetch("/api/reductor/anonymize-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileKey }),
      });
      if (!resp.ok) {
        const errData = await resp.json();
        throw new Error(errData.error || `HTTP ${resp.status}`);
      }
      const data = await resp.json();
      setResults((prev) => new Map(prev).set(fileKey, data));
    } catch (err: any) {
      setError(err.message || "Anonymization failed");
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return <div className="max-w-4xl mx-auto p-6">Loading files...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Reductor - DOCX Anonymizer</h1>
      <p className="text-gray-600">
        Select DOCX files from MinIO to remove student identity (name & roll number) while preserving layout.
      </p>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>}

      {files.length === 0 ? (
        <div className="text-gray-500 text-center py-12">No DOCX files found in MinIO.</div>
      ) : (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">DOCX Files ({files.length})</h2>
          <div className="grid gap-3">
            {files.map((file) => {
              const result = results.get(file.key);
              return (
                <div key={file.key} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{file.name}</p>
                      <p className="text-sm text-gray-600">
                        Size: {(file.size / 1024).toFixed(1)} KB • Modified: {new Date(file.lastModified).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => onAnonymize(file.key)}
                      disabled={processing === file.key || !!result}
                      className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50 whitespace-nowrap ml-4"
                    >
                      {processing === file.key ? "Processing..." : result ? "Done" : "Anonymize"}
                    </button>
                  </div>

                  {/* Result / Download */}
                  {result && (
                    <div className="mt-3 pt-3 border-t space-y-2">
                      <p className="text-sm text-green-700 font-medium">✅ Anonymization Complete</p>
                      <div className="flex gap-2">
                        <a
                          href={result.download_url}
                          className="px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                        >
                          Download Anonymized
                        </a>
                        <a
                          href={`/api/reductor/download?fileKey=${encodeURIComponent(result.original_file)}`}
                          className="px-3 py-2 bg-gray-400 text-white text-sm rounded hover:bg-gray-500"
                        >
                          Download Original
                        </a>
                      </div>
                      <p className="text-xs text-gray-500">Output: {result.anonymized_file}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
