import { BrowserRouter, Routes, Route } from "react-router-dom";
import Whiteboard from "./components/Whiteboard";
import ChatInterface from "./components/ChatInterface";
import "./index.css";

function App() {
  return (
    <BrowserRouter>
      <div className="h-screen w-screen flex overflow-hidden bg-slate-50">
        <main className="relative flex-grow overflow-hidden">
          <Routes>
            <Route path="/" element={<Whiteboard />} />
          </Routes>
        </main>
        <aside className="w-80 border-l border-slate-200 bg-white shadow-xl">
          <ChatInterface />
        </aside>
      </div>
    </components>
  );
}

function Whiteboard() {
  return (
    <div className="h-full w-full">
      {/* Excalidraw component will go here */}
      <div className="flex h-full items-center justify-center bg-slate-100 text-slate-400">
        Excalidraw Canvas Placeholder
      </div>
    </div>
  );
}

function ChatInterface() {
  return (
    <div className="flex h-full flex-col p-4">
      <h2 className="mb-4 text-xl font-bold text-slate-800">Agent Chat</h2>
      <div className="flex-1 overflow-y-auto space-y-4">
        {/* Chat messages will go here */}
        <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          Hello! I am your whiteboard agent. Ask me to draw something!
        </div>
      </div>
      <div className="mt-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Type a command..."
            className="w-full rounded-full border border-slate-300 py-2 pl-4 pr-12 focus:border-blue-500 focus:outline-null focus:ring-1 focus:ring-blue-500"
          />
          <button className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-blue-500 p-2 text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
