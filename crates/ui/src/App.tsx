import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { WorkspaceLayout } from "./components/WorkspaceLayout";
import { ChatPage } from "./pages/ChatPage";
import { FilesPage } from "./pages/FilesPage";
import { TerminalPage } from "./pages/TerminalPage";
import { MemoryPage } from "./pages/MemoryPage";
import { SkillsPage } from "./pages/SkillsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { InspectorPage } from "./pages/InspectorPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { CronPage } from "./pages/CronPage";
import { EnvPage } from "./pages/EnvPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WorkspaceLayout />}>
          <Route index element={<Navigate to="/chat" replace />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="inspector" element={<InspectorPage />} />
          <Route path="files" element={<FilesPage />} />
          <Route path="terminal" element={<TerminalPage />} />
          <Route path="memory" element={<MemoryPage />} />
          <Route path="skills" element={<SkillsPage />} />
          <Route path="cron" element={<CronPage />} />
          <Route path="env" element={<EnvPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
