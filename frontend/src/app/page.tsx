"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  CloudUpload, MessageSquare, ShieldAlert, FileSearch,
  SplitSquareHorizontal, FileText, ShieldCheck, Search, ZoomIn, ZoomOut, Send, File
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";

const API_BASE_URL = 'http://localhost:8000';

export default function Dashboard() {
  const [activeView, setActiveView] = useState("upload");
  const [currentContractId, setCurrentContractId] = useState<string | null>(null);
  const [currentContractName, setCurrentContractName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");
  const [recentUploads, setRecentUploads] = useState<{ id: string; name: string }[]>([]);

  // Chat state
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<{ text: string; isUser: boolean; isHtml?: boolean }[]>([
    { text: "Hello, I am your Legal AI Assistant. How can I help you analyze the document today?", isUser: false }
  ]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"chat" | "risk">("chat");
  const [riskReviewText, setRiskReviewText] = useState<string | null>(null);
  const [loadingRisk, setLoadingRisk] = useState(false);
  
  // Precedent & Compare state
  const [precedentDetails, setPrecedentDetails] = useState<any[]>([]);
  const [expandedPrecedent, setExpandedPrecedent] = useState<number | null>(null);
  const [loadingPrecedent, setLoadingPrecedent] = useState(false);

  const [compareContractA, setCompareContractA] = useState<string>("");
  const [compareContractB, setCompareContractB] = useState<string>("");
  const [comparisonResults, setComparisonResults] = useState<any[]>([]);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const compareFileInputRef = useRef<HTMLInputElement>(null);

  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, loadingChat]);

  const scrollToDropZone = () => {
    dropZoneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Small delay then open file picker after scroll
    setTimeout(() => fileInputRef.current?.click(), 400);
  };

  const fetchRisk = async () => {
    if (!currentContractId) return;
    setLoadingRisk(true);
    try {
      const response = await fetch(`${API_BASE_URL}/risk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contract_id: currentContractId })
      });
      if (response.ok) {
        const data = await response.json();
        setRiskReviewText(data.risk_review);
      } else {
        const text = await response.text();
        console.error("Risk API error:", text);
        setRiskReviewText(`Error loading risk review: Server responded with status ${response.status}`);
      }
    } catch (e: any) {
      console.error("Risk network error:", e);
      setRiskReviewText(`Failed to connect to the backend: ${e.message}`);
    } finally {
      setLoadingRisk(false);
    }
  };

  useEffect(() => {
    if ((activeView === "risk" || sidebarTab === "risk") && currentContractId && !riskReviewText && !loadingRisk) {
      fetchRisk();
    }
  }, [activeView, currentContractId, riskReviewText, sidebarTab, loadingRisk]);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setUploadProgress(10);
    setUploadStatus("Uploading to server...");
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();

      if (response.ok) {
        const cId = data.contract_id;
        setCurrentContractId(cId);
        setCurrentContractName(file.name);
        setPdfBlobUrl(null);
        setReportContent(null);

        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch(`${API_BASE_URL}/contracts/${cId}/status`);
            if (statusRes.ok) {
              const statusData = await statusRes.json();
              setUploadStatus(statusData.status);

              if (statusData.status === "parsing") setUploadProgress(30);
              else if (statusData.status === "chunking") setUploadProgress(50);
              else if (statusData.status === "classifying") setUploadProgress(70);
              else if (statusData.status === "embedding") setUploadProgress(90);
              else if (statusData.status === "completed") {
                setUploadProgress(100);
                clearInterval(pollInterval);
                setRecentUploads(prev => [{ id: cId, name: file.name }, ...prev]);
                try {
                  const fileRes = await fetch(`${API_BASE_URL}/contracts/${cId}/file`);
                  if (fileRes.ok) {
                    const blob = await fileRes.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    setPdfBlobUrl(blobUrl);
                  }
                } catch (e) {
                  console.error("Failed to load PDF blob", e);
                }
                setTimeout(() => {
                  setUploading(false);
                  setActiveView("chat");
                }, 1000);
              } else if (statusData.status.startsWith("error")) {
                clearInterval(pollInterval);
                setUploading(false);
                alert("Processing failed: " + statusData.status);
              }
            }
          } catch (e) {
            console.error("Polling error", e);
          }
        }, 1000);

      } else {
        alert("Upload failed: " + (data.detail || "Unknown error"));
        setUploading(false);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert("Failed to connect to the backend server.");
      setUploading(false);
    }
  };

  const handleCompareUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    setUploadStatus("Uploading Contract B...");
    try {
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (response.ok) {
        const cId = data.contract_id;
        setRecentUploads(prev => [{ id: cId, name: file.name }, ...prev]);
        
        // Polling loop for compare upload
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch(`${API_BASE_URL}/contracts/${cId}/status`);
            if (statusRes.ok) {
              const statusData = await statusRes.json();
              setUploadStatus(`Contract B processing: ${statusData.status}`);
              if (statusData.status === "completed") {
                clearInterval(pollInterval);
                setCompareContractB(cId);
                setUploadStatus("");
                alert("Contract B uploaded and processed!");
              } else if (statusData.status.startsWith("error")) {
                clearInterval(pollInterval);
                setUploadStatus("");
                alert("Processing failed: " + statusData.status);
              }
            }
          } catch (e) {
            console.error("Polling error", e);
          }
        }, 1000);
      } else {
        alert("Upload failed: " + (data.detail || "Unknown error"));
        setUploadStatus("");
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert("Failed to connect to the backend server.");
      setUploadStatus("");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const triggerInput = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;
    if (!currentContractId) {
      alert('Please upload a contract first before asking questions.');
      setActiveView('upload');
      return;
    }

    const newHistory = [...chatHistory, { text, isUser: true }];
    setChatHistory(newHistory);
    setChatInput("");
    setLoadingChat(true);

    try {
      const response = await fetch(`${API_BASE_URL}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contract_id: currentContractId,
          question: text,
          top_k: 3
        })
      });
      const data = await response.json();

      if (response.ok) {
        let aiReply = "";
        if (data.answer) {
          aiReply += `<p>${data.answer.replace(/\n/g, '<br>')}</p><br>`;
        }
        if (data.results && data.results.length > 0) {
          aiReply += `<strong>Citations:</strong><br>`;
          data.results.forEach((res: any, idx: number) => {
            aiReply += `<em>Citation ${idx + 1}</em> (Page ${res.page_start || 'N/A'}): ${res.text}<br><br>`;
          });
          setChatHistory([...newHistory, { text: aiReply, isUser: false, isHtml: true }]);
        } else if (data.answer) {
          setChatHistory([...newHistory, { text: aiReply, isUser: false, isHtml: true }]);
        } else {
          setChatHistory([...newHistory, { text: "I couldn't find any relevant information regarding that question in the current contract.", isUser: false }]);
        }
      } else {
        setChatHistory([...newHistory, { text: "Sorry, I encountered an error while processing your request.", isUser: false }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setChatHistory([...newHistory, { text: "Failed to connect to the backend server.", isUser: false }]);
    } finally {
      setLoadingChat(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col p-6">
        <div 
          className="flex items-center gap-2 text-blue-600 font-bold text-xl mb-10 cursor-pointer" 
          onClick={() => setActiveView("upload")}
        >
          <ShieldCheck className="w-7 h-7" />
          <span>LegalIntelligence</span>
        </div>

        <nav className="flex flex-col gap-2">
          <Button variant={activeView === "upload" || activeView === "chat" || activeView === "risk" ? "secondary" : "ghost"} className="justify-start" onClick={() => setActiveView("upload")}>
            <CloudUpload className="mr-2 h-4 w-4" /> Upload & Analyze
          </Button>
          <Button variant={activeView === "precedents" ? "secondary" : "ghost"} className="justify-start" onClick={() => setActiveView("precedents")}>
            <FileSearch className="mr-2 h-4 w-4" /> Precedent Search
          </Button>
          <Button variant={activeView === "compare" ? "secondary" : "ghost"} className="justify-start" onClick={() => setActiveView("compare")}>
            <SplitSquareHorizontal className="mr-2 h-4 w-4" /> Compare Contracts
          </Button>
          <Button variant={activeView === "reports" ? "secondary" : "ghost"} className="justify-start" onClick={() => setActiveView("reports")}>
            <FileText className="mr-2 h-4 w-4" /> Generate Report
          </Button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">

        {/* VIEW: UPLOAD */}
        {activeView === "upload" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            <section className="flex flex-col md:flex-row items-center justify-between gap-8 bg-gradient-to-br from-slate-50 to-white p-8 rounded-2xl border border-gray-200">
              <div className="flex-1 max-w-xl space-y-4">
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">AI Powered Legal Contract Intelligence</h1>
                <p className="text-lg text-gray-600">
                  Upload contracts, identify legal risks, compare agreements, search precedents, and generate professional AI assisted reports all from one intuitive workspace.
                </p>
                <Button size="lg" onClick={scrollToDropZone}>Upload Contract</Button>
              </div>
              <div className="flex-1 flex justify-end">
                <div className="rounded-2xl overflow-hidden shadow-lg border border-gray-200 max-w-sm">
                  <img src="https://i.pinimg.com/736x/96/cc/6e/96cc6e6684b54a850e27aa60e4cc610c.jpg" alt="Contract Illustration" className="w-full h-auto" />
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { icon: <ShieldCheck />, title: "AI Contract Analysis", desc: "Instantly analyze uploaded contracts and understand key provisions." },
                { icon: <MessageSquare />, title: "AI Chat Assistant", desc: "Ask natural language questions about any clause and receive cited answers." },
                { icon: <ShieldAlert />, title: "Risk Review", desc: "Detect risky, missing, or unusual clauses with clear severity indicators." },
                { icon: <FileSearch />, title: "Precedent Search", desc: "Find relevant court cases, legal precedents, and supporting citations." },
                { icon: <SplitSquareHorizontal />, title: "Contract Comparison", desc: "Compare two agreements side by side and highlight differences." },
                { icon: <FileText />, title: "Report Generator", desc: "Generate a professional legal review report with risks and recommendations." }
              ].map((feature, i) => (
                <Card key={i} className="hover:shadow-md transition-shadow hover:border-blue-200">
                  <CardHeader>
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mb-4">
                      {feature.icon}
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                    <CardDescription>{feature.desc}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </section>

            {/* Hidden file input lives OUTSIDE the drop zone to avoid click-bubble conflicts */}
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept=".pdf,.docx,.txt"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileUpload(e.target.files[0]);
                  e.target.value = '';
                }
              }}
            />

            <section className="space-y-6">
              <div
                ref={dropZoneRef}
                className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center bg-gray-50 hover:bg-blue-50 hover:border-blue-400 transition-colors"
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDrop(e); }}
              >
                <CloudUpload className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Drag & Drop contract here</h3>
                <p className="text-gray-500 mb-6">Supports PDF, DOCX, TXT</p>
                {uploading ? (
                  <div className="w-full max-w-xs mx-auto space-y-2">
                    <div className="text-sm font-medium text-blue-600">{uploadStatus}</div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    Browse Files
                  </Button>
                )}
              </div>

              {recentUploads.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900">Recently Uploaded</h4>
                  <div className="flex flex-col gap-3">
                    {recentUploads.map((doc, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-blue-400 cursor-pointer"
                        onClick={async () => {
                          setCurrentContractId(doc.id);
                          setCurrentContractName(doc.name);
                          setRiskReviewText(null);
                          setReportContent(null);
                          setChatHistory([{ text: "Hello, I am your Legal AI Assistant. How can I help you analyze the document today?", isUser: false }]);
                          setPdfBlobUrl(null);
                          try {
                            const fileRes = await fetch(`${API_BASE_URL}/contracts/${doc.id}/file`);
                            if (fileRes.ok) {
                              const blob = await fileRes.blob();
                              setPdfBlobUrl(URL.createObjectURL(blob));
                            }
                          } catch (e) {
                            console.error("PDF load error", e);
                          }
                          setActiveView("chat");
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <File className="text-gray-400" />
                          <span className="font-medium text-gray-900">{doc.name}</span>
                        </div>
                        <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">Ready</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {activeView === "chat" && (
          <div className="flex gap-6 h-full animate-in fade-in duration-500">
            <div className="flex-[6] bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
              <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-gray-50 flex-shrink-0">
                <h3 className="font-semibold text-gray-900 text-sm truncate flex-1 mr-2">{currentContractName || "No Document Selected"}</h3>
              </div>
              <div className="flex-1 overflow-hidden">
                {pdfBlobUrl ? (
                  <iframe
                    key={pdfBlobUrl}
                    src={`${pdfBlobUrl}#toolbar=1&navpanes=0`}
                    className="w-full h-full border-none"
                    title="Document Viewer"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                    <FileText className="w-16 h-16 opacity-50 mb-4" />
                    <p>Upload or select a document to view</p>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar (Chat / Risk) */}
            <div className="flex-[4] bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
              <div className="flex border-b border-gray-200 bg-gray-50">
                <button 
                  className={`flex-1 p-4 font-semibold text-center border-b-2 transition-colors ${sidebarTab === 'chat' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                  onClick={() => setSidebarTab('chat')}
                >
                  AI Chat
                </button>
                <button 
                  className={`flex-1 p-4 font-semibold text-center border-b-2 transition-colors ${sidebarTab === 'risk' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                  onClick={() => setSidebarTab('risk')}
                >
                  Risk Analysis
                </button>
              </div>

              {sidebarTab === 'chat' && (
                <>
                  <div className="flex-1 p-4 overflow-y-auto min-h-0">
                    <div className="flex flex-col gap-4 pb-4">
                      {chatHistory.map((msg, idx) => (
                        <div key={idx} className={`max-w-[85%] p-3 rounded-xl text-sm ${msg.isUser
                            ? 'bg-blue-600 text-white self-end rounded-br-sm'
                            : 'bg-gray-100 text-gray-800 self-start rounded-bl-sm border border-gray-200'
                          }`}>
                          {msg.isHtml ? (
                            <div dangerouslySetInnerHTML={{ __html: msg.text }} />
                          ) : (
                            msg.text
                          )}
                        </div>
                      ))}
                      {loadingChat && (
                        <div className="max-w-[85%] p-3 rounded-xl text-sm bg-gray-100 text-gray-800 self-start rounded-bl-sm border border-gray-200 animate-pulse">
                          Thinking...
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>

                  <div className="p-4 border-t border-gray-200 bg-white">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Ask anything about the contract..."
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSendMessage(chatInput)}
                        className="rounded-full"
                      />
                      <Button size="icon" className="rounded-full bg-blue-600 hover:bg-blue-700" onClick={() => handleSendMessage(chatInput)}>
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {sidebarTab === 'risk' && (
                <div className="flex-1 p-6 overflow-y-auto min-h-0">
                  {!currentContractId ? (
                    <p className="text-gray-500 text-center mt-10">Please upload a contract first.</p>
                  ) : loadingRisk ? (
                    <div className="flex flex-col items-center justify-center mt-10 text-gray-500 animate-pulse">
                      <ShieldAlert className="w-12 h-12 mb-4 opacity-50" />
                      <p>Generating risk review...</p>
                      <p className="text-xs mt-2">This may take a moment.</p>
                    </div>
                  ) : riskReviewText ? (
                    <div className="flex flex-col gap-4">
                      <div className="prose prose-sm prose-blue max-w-none text-gray-800" dangerouslySetInnerHTML={{ __html: riskReviewText }} />
                      {(riskReviewText.includes("Failed to connect") || riskReviewText.includes("Error loading")) && (
                        <Button variant="outline" onClick={fetchRisk} className="mt-4 self-center">Try Again</Button>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW: RISK */}
        {activeView === "risk" && (
          <div className="animate-in fade-in duration-500 space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">AI Risk Review</h2>
            {!currentContractId ? (
              <p className="text-gray-500">Please upload a contract first.</p>
            ) : loadingRisk ? (
              <p className="text-gray-500 animate-pulse">Generating risk review... this may take a moment.</p>
            ) : (
              <Card className="border-gray-200">
                <CardHeader>
                  <CardTitle className="text-lg">Risk Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-blue max-w-none text-gray-800" dangerouslySetInnerHTML={{ __html: riskReviewText || "" }} />
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* VIEW: PRECEDENTS */}
        {activeView === "precedents" && (
          <div className="animate-in fade-in duration-500 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Precedent Search</h2>
              {currentContractId && (
                <Button
                  onClick={async () => {
                    setPrecedentDetails([]);
                    setLoadingPrecedent(true);
                    try {
                      const res = await fetch(`${API_BASE_URL}/precedent`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ contract_id: currentContractId })
                      });
                      if (res.ok) {
                        const data = await res.json();
                        setPrecedentDetails(data.precedents || []);
                      } else {
                        const err = await res.text();
                        alert("Error: " + err);
                      }
                    } catch (e: any) {
                      alert("Failed to connect to backend: " + e.message);
                    } finally {
                      setLoadingPrecedent(false);
                    }
                  }}
                  disabled={loadingPrecedent}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {loadingPrecedent ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                      Searching Case Law...
                    </span>
                  ) : "Search Case Law"}
                </Button>
              )}
            </div>

            {!currentContractId ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <FileSearch className="w-12 h-12 mb-4 opacity-50" />
                <p className="font-medium">No contract loaded</p>
                <p className="text-sm mt-1">Please upload a contract first, then search for relevant case law.</p>
                <Button className="mt-4" onClick={() => setActiveView('upload')}>Upload Contract</Button>
              </div>
            ) : loadingPrecedent ? (
              <div className="space-y-4">
                {[1,2,3].map(i => (
                  <div key={i} className="bg-white border border-gray-200 rounded-2xl p-6 animate-pulse">
                    <div className="h-5 bg-gray-200 rounded w-1/2 mb-3"></div>
                    <div className="h-3 bg-gray-100 rounded w-1/3 mb-4"></div>
                    <div className="h-3 bg-gray-100 rounded w-full mb-2"></div>
                    <div className="h-3 bg-gray-100 rounded w-4/5"></div>
                  </div>
                ))}
                <p className="text-center text-blue-600 text-sm animate-pulse">Searching for relevant case law... this may take up to 30 seconds.</p>
              </div>
            ) : precedentDetails.length === 0 ? (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-8 text-center">
                <FileSearch className="w-10 h-10 text-blue-400 mx-auto mb-3" />
                <p className="text-blue-700 font-medium">Click "Search Case Law" to find relevant precedents</p>
                <p className="text-blue-500 text-sm mt-1">The AI will analyze your contract and find related case law.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">Found {precedentDetails.length} relevant precedent(s) for <strong>{currentContractName}</strong></p>
                {precedentDetails.map((p, idx) => (
                  <div key={idx} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <h3 className="text-base font-bold text-gray-900">{p.case_name}</h3>
                          <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                            <span className="bg-white border border-gray-200 px-2 py-0.5 rounded">{p.court}</span>
                            <span className="bg-white border border-gray-200 px-2 py-0.5 rounded">{p.date}</span>
                            <span className="bg-white border border-gray-200 px-2 py-0.5 rounded font-mono">{p.citation}</span>
                          </div>
                        </div>
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 shrink-0">Relevant</Badge>
                      </div>
                    </div>
                    <div className="p-5">
                      <p className="text-gray-700 text-sm leading-relaxed">{p.summary}</p>
                      <button
                        onClick={() => setExpandedPrecedent(expandedPrecedent === idx ? null : idx)}
                        className="mt-3 text-blue-600 text-sm font-medium hover:underline flex items-center gap-1"
                      >
                        {expandedPrecedent === idx ? "▲ Hide Details" : "▼ View Details"}
                      </button>
                      {expandedPrecedent === idx && (
                        <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-sm">
                          <strong className="block mb-1">Why this is relevant:</strong>
                          {p.relevance}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW: COMPARE */}
        {activeView === "compare" && (
          <div className="animate-in fade-in duration-500 space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Contract Comparison</h2>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Contract A (Original)</label>
                  <select
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={compareContractA}
                    onChange={(e) => setCompareContractA(e.target.value)}
                  >
                    <option value="">-- Select a contract --</option>
                    {recentUploads.map(doc => (
                      <option key={doc.id} value={doc.id}>{doc.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Contract B (Revised/Other)</label>
                  <div className="flex gap-2">
                    <select
                      className="flex-1 p-2.5 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={compareContractB}
                      onChange={(e) => setCompareContractB(e.target.value)}
                    >
                      <option value="">-- Select a contract --</option>
                      {recentUploads.map(doc => (
                        <option key={doc.id} value={doc.id}>{doc.name}</option>
                      ))}
                    </select>
                    <input
                      type="file"
                      ref={compareFileInputRef}
                      style={{ display: 'none' }}
                      accept=".pdf,.docx,.txt"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleCompareUpload(e.target.files[0]);
                          e.target.value = '';
                        }
                      }}
                    />
                    <Button variant="outline" onClick={() => compareFileInputRef.current?.click()}>Upload New</Button>
                  </div>
                  {uploadStatus && uploadStatus.includes("Contract B") && (
                    <p className="text-xs text-blue-500 mt-2">{uploadStatus}</p>
                  )}
                </div>
              </div>

              <Button
                disabled={!compareContractA || !compareContractB || loadingCompare}
                onClick={async () => {
                  setComparisonResults([]);
                  setLoadingCompare(true);
                  try {
                    const res = await fetch(`${API_BASE_URL}/compare`, {
                      method: 'POST',
                      headers: {'Content-Type': 'application/json'},
                      body: JSON.stringify({ contract_id_a: compareContractA, contract_id_b: compareContractB })
                    });
                    if (res.ok) {
                      const data = await res.json();
                      setComparisonResults(data.comparisons || []);
                    } else {
                      const err = await res.text();
                      alert("Error generating comparison: " + err);
                    }
                  } catch (e: any) {
                    alert("Failed to connect to backend: " + e.message);
                  } finally {
                    setLoadingCompare(false);
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loadingCompare ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                    Comparing...
                  </span>
                ) : "Run Clause-by-Clause Comparison"}
              </Button>
            </div>

            {loadingCompare && (
              <div className="space-y-3">
                {[1,2,3].map(i => (
                  <div key={i} className="bg-white border border-gray-200 rounded-2xl p-5 animate-pulse">
                    <div className="flex justify-between mb-3">
                      <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                      <div className="h-4 bg-gray-100 rounded w-20"></div>
                    </div>
                    <div className="h-3 bg-gray-100 rounded w-full mb-2"></div>
                    <div className="flex gap-4 mt-4">
                      <div className="flex-1 h-16 bg-gray-100 rounded"></div>
                      <div className="flex-1 h-16 bg-gray-100 rounded"></div>
                    </div>
                  </div>
                ))}
                <p className="text-center text-blue-600 text-sm animate-pulse">Comparing contracts clause by clause... this may take up to a minute.</p>
              </div>
            )}

            {!loadingCompare && comparisonResults.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Comparison Results <span className="text-sm font-normal text-gray-500 ml-2">({comparisonResults.length} clauses found)</span>
                </h3>
                {comparisonResults.map((comp, idx) => (
                  <div key={idx} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                    {/* Card Header */}
                    <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-gray-200">
                      <h4 className="font-semibold text-gray-900 capitalize">{comp.clause_type} Clause</h4>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        comp.status === "present_in_both"
                          ? "bg-blue-100 text-blue-700"
                          : comp.status === "only_in_a"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-purple-100 text-purple-700"
                      }`}>
                        {comp.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    {/* Summary */}
                    <div className="px-5 py-3 bg-blue-50 border-b border-blue-100">
                      <p className="text-blue-900 text-sm font-medium">{comp.difference_summary}</p>
                    </div>
                    {/* Side by Side Text */}
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
                      <div className="p-5">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Contract A</p>
                        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{comp.text_a || <em className="text-gray-400">Not present in this contract</em>}</p>
                      </div>
                      <div className="p-5">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Contract B</p>
                        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{comp.text_b || <em className="text-gray-400">Not present in this contract</em>}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeView === "reports" && (
          <div className="animate-in fade-in duration-500 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Report Generator</h2>
            </div>

            {!currentContractId ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <FileText className="w-12 h-12 mb-4 opacity-50" />
                <p className="font-medium">No contract loaded</p>
                <p className="text-sm mt-1">Please upload a contract first to generate a report.</p>
                <Button className="mt-4" onClick={() => setActiveView('upload')}>Upload Contract</Button>
              </div>
            ) : (
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 bg-slate-50 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">Legal Review Report</h3>
                      <p className="text-sm text-gray-500 mt-0.5">{currentContractName}</p>
                    </div>
                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">AI Generated</Badge>
                  </div>
                  <div className="p-6">
                    {!reportContent && !loadingReport && (
                      <div className="flex flex-col items-center justify-center py-10 text-gray-500">
                        <FileText className="w-10 h-10 mb-3 opacity-40" />
                        <p className="text-sm mb-4">Click the button below to generate a full AI-powered legal review report for this contract.</p>
                        <Button
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={async () => {
                            setLoadingReport(true);
                            try {
                              const res = await fetch(`${API_BASE_URL}/report/generate/${currentContractId}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                              });
                              if (res.ok) {
                                const data = await res.json();
                                setReportContent(data.report || 'Report generated but no content returned.');
                              } else {
                                const err = await res.text();
                                setReportContent(`Failed to generate report: ${err}`);
                              }
                            } catch (e: any) {
                              setReportContent(`Error: ${e.message}`);
                            } finally {
                              setLoadingReport(false);
                            }
                          }}
                        >
                          Generate Report
                        </Button>
                      </div>
                    )}
                    {loadingReport && (
                      <div className="flex flex-col items-center justify-center py-10 text-gray-500 animate-pulse">
                        <svg className="animate-spin h-8 w-8 mb-3 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                        <p className="text-sm">Generating report... this may take a minute.</p>
                      </div>
                    )}
                    {reportContent && !loadingReport && (
                      <div className="space-y-4">
                        <div className="prose prose-sm prose-blue max-w-none text-gray-800">
                          <ReactMarkdown>{reportContent}</ReactMarkdown>
                        </div>
                        <div className="pt-4 border-t border-gray-100">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setReportContent(null);
                            }}
                          >
                            Generate New Report
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
