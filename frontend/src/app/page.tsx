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

const API_BASE_URL = 'http://localhost:8000';

export default function Dashboard() {
  const [activeView, setActiveView] = useState("upload");
  const [currentContractId, setCurrentContractId] = useState<string | null>(null);
  const [currentContractName, setCurrentContractName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
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
      const data = await response.json();
      if (response.ok) {
        setRiskReviewText(data.risk_review);
      } else {
        setRiskReviewText("Error loading risk review.");
      }
    } catch (e) {
      setRiskReviewText("Failed to connect to the backend.");
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
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();

      if (response.ok) {
        setCurrentContractId(data.contract_id);
        setCurrentContractName(file.name);
        setRecentUploads(prev => [{ id: data.contract_id, name: file.name }, ...prev]);
        setActiveView("chat");
      } else {
        alert("Upload failed: " + (data.detail || "Unknown error"));
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert("Failed to connect to the backend server.");
    } finally {
      setUploading(false);
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
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? 'Uploading...' : 'Browse Files'}
                </Button>
              </div>

              {recentUploads.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900">Recently Uploaded</h4>
                  <div className="flex flex-col gap-3">
                    {recentUploads.map((doc, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-blue-400 cursor-pointer"
                        onClick={() => {
                          setCurrentContractId(doc.id);
                          setCurrentContractName(doc.name);
                          setRiskReviewText(null);
                          setChatHistory([{ text: "Hello, I am your Legal AI Assistant. How can I help you analyze the document today?", isUser: false }]);
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

        {/* VIEW: CHAT */}
        {activeView === "chat" && (
          <div className="flex gap-6 h-full animate-in fade-in duration-500">
            {/* Document Viewer */}
            <div className="flex-[6] bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <h3 className="font-semibold text-gray-900">{currentContractName || "No Document Selected"}</h3>
              </div>
              <div className="flex-1 bg-gray-100 flex items-center justify-center text-gray-400 flex-col overflow-hidden">
                {currentContractId ? (
                  <iframe 
                    src={`${API_BASE_URL}/contracts/${currentContractId}/file`} 
                    className="w-full h-full border-none bg-white"
                    title="Document Viewer"
                  />
                ) : (
                  <>
                    <FileText className="w-16 h-16 opacity-50 mb-4" />
                    <p>Upload or select a document to view</p>
                  </>
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
            <h2 className="text-2xl font-bold text-gray-900">Precedent Search</h2>
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">Smith v. TechCorp</CardTitle>
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">98% Match</Badge>
                </div>
                <div className="text-sm text-gray-500 flex gap-2 mt-2">
                  <span>Delaware Chancery Court</span> | <span>2021</span> | <span>Citation: 123 Del. Ch. 45</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 mb-4">Court ruled that uncapped indemnification in software agreements requires explicit mutual consent and clear highlighting.</p>
                <Button variant="link" className="px-0">View Details</Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* VIEW: COMPARE */}
        {activeView === "compare" && (
          <div className="animate-in fade-in duration-500 space-y-6 h-full flex flex-col">
            <h2 className="text-2xl font-bold text-gray-900">Contract Comparison</h2>
            <div className="flex gap-4 flex-1 pb-10">
              <Card className="flex-1 flex flex-col overflow-hidden">
                <CardHeader className="bg-slate-50 border-b">
                  <CardTitle className="text-md">Original Agreement</CardTitle>
                </CardHeader>
                <ScrollArea className="flex-1 p-4">
                  <p className="bg-red-50 text-red-700 line-through p-1 rounded">The supplier shall provide notice within 30 days.</p>
                </ScrollArea>
              </Card>
              <Card className="flex-1 flex flex-col overflow-hidden">
                <CardHeader className="bg-slate-50 border-b">
                  <CardTitle className="text-md">Revised Agreement</CardTitle>
                </CardHeader>
                <ScrollArea className="flex-1 p-4">
                  <p className="bg-green-50 text-green-700 p-1 rounded">The supplier shall provide written notice within 15 days.</p>
                </ScrollArea>
              </Card>
            </div>
          </div>
        )}

        {/* VIEW: REPORTS */}
        {activeView === "reports" && (
          <div className="animate-in fade-in duration-500 space-y-6 flex justify-center">
            <div className="w-full max-w-3xl">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Report Generator</h2>
              <Card className="shadow-lg">
                <CardHeader className="border-b bg-slate-50 flex flex-row justify-between items-center">
                  <CardTitle>Legal Review Report</CardTitle>
                  <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Moderate Risk</Badge>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  <div>
                    <h4 className="text-blue-600 font-semibold mb-2">Executive Summary</h4>
                    <p className="text-gray-700">The agreement is generally standard, but contains notable risks concerning liability caps and auto-renewal terms.</p>
                  </div>
                  <div>
                    <h4 className="text-blue-600 font-semibold mb-2">Identified Risks</h4>
                    <ul className="list-disc pl-5 text-gray-700 space-y-1">
                      <li>Uncapped indemnification (High)</li>
                      <li>60-day auto-renewal notice (Medium)</li>
                    </ul>
                  </div>
                </CardContent>
                <CardFooter className="bg-slate-50 border-t p-6">
                  <Button className="w-full" size="lg">Download PDF Report</Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
