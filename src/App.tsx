/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Editor from "./pages/Editor";
import Admin from "./pages/Admin";
import Login from "./pages/Login";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="editor/:id" element={<Editor />} />
          <Route path="admin" element={<Admin />} />
          <Route path="admin/login" element={<Login />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
