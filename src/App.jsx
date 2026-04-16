import React from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Layout from "./components/common/Layout";
import TodaysPlan from "./pages/TodaysPlan";
import LiveSession from "./pages/LiveSession";
import WastageReport from "./pages/WastageReport";
import Groups from "./pages/Groups";
import Leaderboard from "./pages/Leaderboard";
import "./index.css";

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/"            element={<TodaysPlan />} />
          <Route path="/live"        element={<LiveSession />} />
          <Route path="/wastage"     element={<WastageReport />} />
          <Route path="/groups"      element={<Groups />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}