import { Navigate, Route, Routes } from "react-router-dom";
import { AppNav } from "./components/AppNav";
import { AgentQueue } from "./pages/AgentQueue";
import { Analytics } from "./pages/Analytics";
import { MyTickets } from "./pages/MyTickets";
import { RaiseTicket } from "./pages/RaiseTicket";

export default function App() {
  return (
    <div className="app-shell">
      <AppNav />
      <Routes>
        <Route path="/" element={<Navigate to="/raise-ticket" replace />} />
        <Route path="/raise-ticket" element={<RaiseTicket />} />
        <Route path="/my-tickets" element={<MyTickets />} />
        <Route path="/agent" element={<AgentQueue />} />
        <Route path="/analytics" element={<Analytics />} />
      </Routes>
    </div>
  );
}
