import React, { useState, useEffect } from "react";
import { Template } from "../types";
import { Plus, Edit, Trash2, Check, X, GripVertical, LogOut, KeyRound } from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { useNavigate } from "react-router-dom";
import ColorPicker from 'react-best-gradient-color-picker';

export default function Admin() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{message: string, onConfirm: () => void} | null>(null);
  const [overlayColor, setOverlayColor] = useState('rgba(0,0,0,0)');
  const [imageOpacity, setImageOpacity] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    key: '',
    width: 1080,
    height: 1920,
    description: '',
    status: true
  });
  const navigate = useNavigate();

  const showToast = (message: string, type: 'success' | 'error' = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchTemplates = () => {
    setLoading(true);
    const token = localStorage.getItem("admin_token");
    fetch("/api/templates", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.status === 401) {
          navigate("/admin/login");
          throw new Error("Unauthorized");
        }
        return res.json();
      })
      .then((data) => {
        setTemplates(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleLogout = async () => {
    const token = localStorage.getItem("admin_token");
    await fetch("/api/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    localStorage.removeItem("admin_token");
    navigate("/admin/login");
  };

  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const oldPassword = formData.get("oldPassword");
    const newPassword = formData.get("newPassword");
    const confirmPassword = formData.get("confirmPassword");

    if (newPassword !== confirmPassword) {
      showToast("两次输入的新密码不一致");
      return;
    }

    const token = localStorage.getItem("admin_token");
    try {
      const res = await fetch("/api/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      if (res.ok) {
        showToast("密码修改成功，请重新登录", "success");
        handleLogout();
      } else if (res.status === 401) {
        navigate("/admin/login");
      } else {
        const err = await res.json();
        showToast(err.error || "修改失败");
      }
    } catch (error) {
      showToast("网络错误");
    }
  };

  const handleSave = async () => {
    try {
      if (!formData.name || !formData.key || !formData.width || !formData.height) {
        showToast("请填写所有必填字段 (模版名称, 标识, 宽度, 高度)");
        return;
      }

      const isGradient = overlayColor?.includes('gradient') || false;
      const data = {
        name: formData.name,
        key: formData.key,
        width: formData.width,
        height: formData.height,
        description: formData.description,
        status: formData.status ? 1 : 0,
        image_opacity: imageOpacity,
        overlay_color: isGradient ? "" : (overlayColor || ""),
        overlay_gradient: isGradient ? (overlayColor || "") : "",
        overlay_opacity: 1, // Opacity is baked into the color string
      };

      const url = editingTemplate?.id
        ? `/api/templates/${editingTemplate.id}`
        : "/api/templates";
      const method = editingTemplate?.id ? "PUT" : "POST";
      const token = localStorage.getItem("admin_token");

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      
      if (res.ok) {
        setIsModalOpen(false);
        fetchTemplates();
        showToast("保存成功", "success");
      } else if (res.status === 401) {
        navigate("/admin/login");
      } else {
        const err = await res.json();
        showToast(err.error || "保存失败");
      }
    } catch (error) {
      console.error("Save error:", error);
      showToast("保存时发生错误，请查看控制台");
    }
  };

  const handleDelete = async (id: number) => {
    setConfirmDialog({
      message: "确定要删除这个模版吗？",
      onConfirm: async () => {
        setConfirmDialog(null);
        const token = localStorage.getItem("admin_token");
        try {
          const res = await fetch(`/api/templates/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            fetchTemplates();
            showToast("删除成功", "success");
          } else if (res.status === 401) {
            navigate("/admin/login");
          } else {
            const err = await res.json().catch(() => ({}));
            showToast(err.error || "删除失败");
          }
        } catch (error) {
          console.error(error);
          showToast("网络错误");
        }
      }
    });
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(templates);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update local state immediately for smooth UI
    setTemplates(items);

    // Prepare data for backend
    const updates = items.map((item: any, index) => ({
      id: item.id,
      sort_order: index + 1,
    }));

    const token = localStorage.getItem("admin_token");
    try {
      const res = await fetch("/api/templates/reorder", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ items: updates }),
      });
      if (res.status === 401) {
        navigate("/admin/login");
      }
    } catch (error) {
      console.error("Failed to save order", error);
      fetchTemplates(); // Revert on error
    }
  };

  const openModal = (template: Template | null = null) => {
    setEditingTemplate(template);
    if (template) {
      setFormData({
        name: template.name,
        key: template.key,
        width: template.width,
        height: template.height,
        description: template.description || '',
        status: template.status === 1
      });
      if (template.overlay_gradient) {
        setOverlayColor(template.overlay_gradient);
      } else if (template.overlay_color) {
        setOverlayColor(template.overlay_color);
      } else {
        setOverlayColor('rgba(0,0,0,0)');
      }
      setImageOpacity(template.image_opacity ?? 1);
    } else {
      setFormData({
        name: '',
        key: '',
        width: 1080,
        height: 1920,
        description: '',
        status: true
      });
      setOverlayColor('rgba(0,0,0,0)');
      setImageOpacity(1);
    }
    setIsModalOpen(true);
  };

  return (
    <div>
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-2 rounded-xl shadow-lg text-white font-medium transition-all ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
          {toast.message}
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[100] overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-zinc-900/50 backdrop-blur-sm" onClick={() => setConfirmDialog(null)}></div>
            <div className="relative inline-block w-full max-w-md p-6 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
              <h3 className="text-lg font-medium leading-6 text-zinc-900 mb-4">确认操作</h3>
              <p className="text-zinc-600 mb-6">{confirmDialog.message}</p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setConfirmDialog(null)}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-xl shadow-sm hover:bg-zinc-50"
                >
                  取消
                </button>
                <button
                  onClick={confirmDialog.onConfirm}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-xl shadow-sm hover:bg-red-700"
                >
                  确定
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">模版管理</h1>
          <p className="mt-2 text-zinc-600">配置前台可用的图片裁剪尺寸规范，拖拽可排序</p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setIsPasswordModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-zinc-300 rounded-xl shadow-sm text-sm font-medium text-zinc-700 bg-white hover:bg-zinc-50"
          >
            <KeyRound className="mr-2 h-4 w-4" />
            修改密码
          </button>
          <button
            onClick={handleLogout}
            className="inline-flex items-center px-4 py-2 border border-zinc-300 rounded-xl shadow-sm text-sm font-medium text-zinc-700 bg-white hover:bg-zinc-50"
          >
            <LogOut className="mr-2 h-4 w-4" />
            退出
          </button>
          <button
            onClick={() => openModal()}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            新建模版
          </button>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-2xl border border-zinc-200 overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-zinc-50 border-b border-zinc-200 text-xs font-medium text-zinc-500 uppercase tracking-wider">
          <div className="col-span-1"></div>
          <div className="col-span-3">模版名称</div>
          <div className="col-span-3">标识 Key</div>
          <div className="col-span-2">尺寸 (宽x高)</div>
          <div className="col-span-2">状态</div>
          <div className="col-span-1 text-right">操作</div>
        </div>

        {loading ? (
          <div className="px-6 py-8 text-center text-zinc-500">加载中...</div>
        ) : templates.length === 0 ? (
          <div className="px-6 py-8 text-center text-zinc-500">暂无模版</div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="templates-list">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="divide-y divide-zinc-200"
                >
                  {templates.map((template, index) => (
                    <React.Fragment key={template.id}>
                      <Draggable
                        draggableId={template.id.toString()}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`grid grid-cols-12 gap-4 px-6 py-4 items-center transition-colors ${
                              snapshot.isDragging ? "bg-primary-50 shadow-md" : "bg-white hover:bg-zinc-50"
                            }`}
                          >
                            <div
                              className="col-span-1 flex items-center text-zinc-400 hover:text-zinc-600"
                              {...provided.dragHandleProps}
                            >
                              <GripVertical className="w-5 h-5 cursor-grab active:cursor-grabbing" />
                            </div>
                            <div className="col-span-3">
                              <div className="text-sm font-medium text-zinc-900">
                                {template.name}
                              </div>
                              <div className="text-sm text-zinc-500 truncate pr-4">
                                {template.description}
                              </div>
                            </div>
                            <div className="col-span-3">
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-zinc-100 text-zinc-800 font-mono">
                                {template.key}
                              </span>
                            </div>
                            <div className="col-span-2 text-sm text-zinc-500 font-mono">
                              {template.width} x {template.height}
                            </div>
                            <div className="col-span-2">
                              {template.status === 1 ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                  <Check className="w-3 h-3 mr-1" />
                                  启用
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  <X className="w-3 h-3 mr-1" />
                                  禁用
                                </span>
                              )}
                            </div>
                            <div className="col-span-1 text-right flex justify-end space-x-3">
                              <button
                                onClick={() => openModal(template)}
                                className="text-primary-600 hover:text-primary-900"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(template.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    </React.Fragment>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div
              className="fixed inset-0 transition-opacity bg-zinc-900/50 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            ></div>

            <div className="relative inline-block w-full max-w-2xl p-6 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
              <h3 className="text-lg font-medium leading-6 text-zinc-900 mb-4">
                {editingTemplate ? "编辑模版" : "新建模版"}
              </h3>
              <div>
                <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                  <div className="space-y-4">
                    <h4 className="font-medium text-zinc-900 border-b pb-2">基础设置</h4>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700">
                        模版名称
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="mt-1 block w-full rounded-xl border-zinc-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700">
                        模版标识 (唯一Key)
                      </label>
                      <input
                        type="text"
                        value={formData.key}
                        onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                        className="mt-1 block w-full rounded-xl border-zinc-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-zinc-700">
                          画布宽度 (px)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={formData.width}
                          onChange={(e) => setFormData({ ...formData, width: parseInt(e.target.value) || 0 })}
                          className="mt-1 block w-full rounded-xl border-zinc-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-700">
                          画布高度 (px)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={formData.height}
                          onChange={(e) => setFormData({ ...formData, height: parseInt(e.target.value) || 0 })}
                          className="mt-1 block w-full rounded-xl border-zinc-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700">
                        适用场景描述
                      </label>
                      <textarea
                        rows={3}
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="mt-1 block w-full rounded-xl border-zinc-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
                      />
                    </div>
                    <div className="flex items-center">
                      <input
                        id="status"
                        type="checkbox"
                        checked={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.checked })}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-zinc-300 rounded"
                      />
                      <label
                        htmlFor="status"
                        className="ml-2 block text-sm text-zinc-900"
                      >
                        启用此模版
                      </label>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium text-zinc-900 border-b pb-2">高级设置 (特殊效果)</h4>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-2">
                        上传图片透明度: {imageOpacity.toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={imageOpacity}
                        onChange={(e) => setImageOpacity(parseFloat(e.target.value))}
                        className="w-full accent-primary-600"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-2">
                        遮罩层颜色/渐变
                      </label>
                      <div className="flex justify-center border border-zinc-200 p-4 rounded-xl bg-zinc-50">
                        <ColorPicker value={overlayColor} onChange={setOverlayColor} />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex justify-end space-x-3 border-t pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-xl shadow-sm hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-xl shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    保存
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div
              className="fixed inset-0 transition-opacity bg-zinc-900/50 backdrop-blur-sm"
              onClick={() => setIsPasswordModalOpen(false)}
            ></div>

            <div className="relative inline-block w-full max-w-md p-6 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
              <h3 className="text-lg font-medium leading-6 text-zinc-900 mb-4">
                修改密码
              </h3>
              <form onSubmit={handleChangePassword}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700">
                      原密码
                    </label>
                    <input
                      type="password"
                      name="oldPassword"
                      required
                      className="mt-1 block w-full rounded-xl border-zinc-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700">
                      新密码
                    </label>
                    <input
                      type="password"
                      name="newPassword"
                      required
                      className="mt-1 block w-full rounded-xl border-zinc-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700">
                      确认新密码
                    </label>
                    <input
                      type="password"
                      name="confirmPassword"
                      required
                      className="mt-1 block w-full rounded-xl border-zinc-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsPasswordModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-xl shadow-sm hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-xl shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    修改密码
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
