import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/common/Layout";
import FirstTimeSetup from "./components/common/FirstTimeSetup";
import TodaysPlan from "./pages/TodaysPlan";
import LiveSession from "./pages/LiveSession";
import WastageReport from "./pages/WastageReport";
import InsightsReport from "./pages/InsightsReport";
import Groups from "./pages/Groups";
import Leaderboard from "./pages/Leaderboard";
import useStore from "./store/useStore";
import { useAuth } from "./hooks/useAuth";
import "./index.css";

function AppInner() {
  const { user } = useAuth();
  const { settings, settingsLoaded, setSettings, currentPlanMode } = useStore();

  // Show first-time setup when: logged in, settings loaded, no setup done
  const showSetup = user && settingsLoaded && !settings?.firstTimeSetup;

  const ReportPage = currentPlanMode === "flexible" ? InsightsReport : WastageReport;

  return (
    <Layout>
      {showSetup && (
        <FirstTimeSetup user={user} onComplete={s => setSettings(s)} />
      )}
      <Routes>
        <Route path="/"            element={<TodaysPlan />} />
        <Route path="/live"        element={<LiveSession />} />
        <Route path="/wastage"     element={<ReportPage />} />
        <Route path="/groups"      element={<Groups />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}
