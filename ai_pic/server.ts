import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import crypto from "crypto";

const db = new Database("templates.db");

// Initialize templates table
db.exec(`
  CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    key TEXT NOT NULL UNIQUE,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    description TEXT,
    status INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    image_opacity REAL DEFAULT 1.0,
    overlay_color TEXT DEFAULT '',
    overlay_gradient TEXT DEFAULT '',
    overlay_opacity REAL DEFAULT 0.0
  )
`);

// Add new columns if they don't exist
const tableInfo = db.prepare("PRAGMA table_info(templates)").all() as any[];
if (!tableInfo.some(col => col.name === 'sort_order')) {
  db.exec("ALTER TABLE templates ADD COLUMN sort_order INTEGER DEFAULT 0");
}
if (!tableInfo.some(col => col.name === 'image_opacity')) {
  db.exec("ALTER TABLE templates ADD COLUMN image_opacity REAL DEFAULT 1.0");
  db.exec("ALTER TABLE templates ADD COLUMN overlay_color TEXT DEFAULT ''");
  db.exec("ALTER TABLE templates ADD COLUMN overlay_gradient TEXT DEFAULT ''");
  db.exec("ALTER TABLE templates ADD COLUMN overlay_opacity REAL DEFAULT 0.0");
}

// Initialize users table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
  )
`);

// Initialize sessions table
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
if (userCount.count === 0) {
  db.prepare("INSERT INTO users (username, password) VALUES (?, ?)").run("admin", "admin");
}

// Insert some default templates if empty
const count = db.prepare("SELECT COUNT(*) as count FROM templates").get() as { count: number };
if (count.count === 0) {
  const insert = db.prepare(
    "INSERT INTO templates (name, key, width, height, description, status, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  insert.run("首页轮播Banner", "home_banner", 1920, 600, "用于PC端首页顶部轮播图", 1, 1);
  insert.run("App开屏页", "app_splash", 1080, 1920, "用于App启动时的全屏广告", 1, 2);
  insert.run("商品缩略图", "product_thumb", 800, 800, "用于商品列表和详情页的主图", 1, 3);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Auth Middleware
  const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (token) {
      const session = db.prepare("SELECT * FROM sessions WHERE token = ?").get(token);
      if (session) {
        return next();
      }
    }
    res.status(401).json({ error: "Unauthorized" });
  };

  // Auth API
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE username = ? AND password = ?").get(username, password);
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      db.prepare("INSERT INTO sessions (token) VALUES (?)").run(token);
      res.json({ token });
    } else {
      res.status(401).json({ error: "用户名或密码错误" });
    }
  });

  app.post("/api/change-password", requireAuth, (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE username = 'admin' AND password = ?").get(oldPassword);
    if (user) {
      db.prepare("UPDATE users SET password = ? WHERE username = 'admin'").run(newPassword);
      res.json({ success: true });
    } else {
      res.status(400).json({ error: "原密码错误" });
    }
  });

  app.post("/api/logout", requireAuth, (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (token) {
      db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    }
    res.json({ success: true });
  });

  app.get("/api/check-auth", requireAuth, (req, res) => {
    res.json({ success: true });
  });

  // API Routes
  app.get("/api/templates", (req, res) => {
    try {
      const templates = db.prepare("SELECT * FROM templates ORDER BY sort_order ASC, id DESC").all();
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  app.post("/api/templates", requireAuth, (req, res) => {
    const { name, key, width, height, description, status, image_opacity, overlay_color, overlay_gradient, overlay_opacity } = req.body;
    try {
      const maxSort = db.prepare("SELECT MAX(sort_order) as max FROM templates").get() as { max: number };
      const nextSort = (maxSort.max || 0) + 1;
      const stmt = db.prepare(
        "INSERT INTO templates (name, key, width, height, description, status, sort_order, image_opacity, overlay_color, overlay_gradient, overlay_opacity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      );
      const info = stmt.run(name, key, width, height, description, status ?? 1, nextSort, image_opacity ?? 1.0, overlay_color ?? '', overlay_gradient ?? '', overlay_opacity ?? 0.0);
      const newTemplate = db.prepare("SELECT * FROM templates WHERE id = ?").get(info.lastInsertRowid);
      res.status(201).json(newTemplate);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create template" });
    }
  });

  app.put("/api/templates/reorder", requireAuth, (req, res) => {
    const { items } = req.body; // [{ id, sort_order }]
    try {
      const stmt = db.prepare("UPDATE templates SET sort_order = ? WHERE id = ?");
      const transaction = db.transaction((items: any[]) => {
        for (const item of items) {
          stmt.run(item.sort_order, item.id);
        }
      });
      transaction(items);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to reorder templates" });
    }
  });

  app.put("/api/templates/:id", requireAuth, (req, res) => {
    const { id } = req.params;
    const { name, key, width, height, description, status, image_opacity, overlay_color, overlay_gradient, overlay_opacity } = req.body;
    try {
      const stmt = db.prepare(
        "UPDATE templates SET name = ?, key = ?, width = ?, height = ?, description = ?, status = ?, image_opacity = ?, overlay_color = ?, overlay_gradient = ?, overlay_opacity = ? WHERE id = ?"
      );
      stmt.run(name, key, width, height, description, status, image_opacity ?? 1.0, overlay_color ?? '', overlay_gradient ?? '', overlay_opacity ?? 0.0, id);
      const updatedTemplate = db.prepare("SELECT * FROM templates WHERE id = ?").get(id);
      res.json(updatedTemplate);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update template" });
    }
  });

  app.delete("/api/templates/:id", requireAuth, (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("DELETE FROM templates WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to delete template" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
