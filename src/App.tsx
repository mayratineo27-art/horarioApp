/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, ReactNode, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { 
  Calendar, 
  Clock, 
  RotateCcw, 
  X, 
  Zap, 
  Heart, 
  Code, 
  Palette, 
  BookOpen,
  User,
  Bell,
  CheckCircle2,
  ChevronRight,
  BellOff,
  Plus,
  Trash2,
  Star,
  Settings
} from 'lucide-react';
import { 
  INITIAL_SCHEDULE, 
  DaySchedule, 
  Activity, 
  Category, 
  OPTIONS_CATALOG 
} from './constants';
import {
  registerServiceWorker,
  subscribeToPush,
  syncScheduleToBackend,
  syncSubscriptionToBackend,
  sendTestPush,
  syncNotificationHours,
} from './push';

export default function App() {
  // --- STATE ---
  const [activeDayIndex, setActiveDayIndex] = useState(() => {
    const today = new Date().getDay(); // 0 is Sunday
    return today === 0 ? 6 : today - 1;
  });

  const todayStr = useMemo(() => new Date().toDateString(), []);
  
  const [schedule, setSchedule] = useState<DaySchedule[]>(() => {
    try {
      const saved = localStorage.getItem('mya_dynamics_schedule');
      const lastDate = localStorage.getItem('mya_dynamics_last_date');
      if (lastDate !== todayStr) return INITIAL_SCHEDULE;
      return saved ? JSON.parse(saved) : INITIAL_SCHEDULE;
    } catch (e) {
      console.error('Error loading schedule', e);
      return INITIAL_SCHEDULE;
    }
  });

  const [completedToday, setCompletedToday] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('mya_dynamics_completed');
      const lastDate = localStorage.getItem('mya_dynamics_last_date');
      if (lastDate !== todayStr) return {};
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [firedNotifications, setFiredNotifications] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('mya_dynamics_fired');
      const lastDate = localStorage.getItem('mya_dynamics_last_date');
      if (lastDate !== todayStr) return {};
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [silencedNotifications, setSilencedNotifications] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('mya_dynamics_silenced');
      const lastDate = localStorage.getItem('mya_dynamics_last_date');
      if (lastDate !== todayStr) return {};
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [pushConfigured, setPushConfigured] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [notificationHourStart, setNotificationHourStart] = useState(7);
  const [notificationHourEnd, setNotificationHourEnd] = useState(22);
  const [showNotificationHoursModal, setShowNotificationHoursModal] = useState(false);
  const [showEditor, setShowEditor] = useState<{ mode: 'add' | 'edit', activityId?: string } | null>(null);
  const [editorData, setEditorData] = useState({ name: '', start: '12:00', end: '13:00', emoji: '📍' });
  const [notification, setNotification] = useState<{title: string, message: string, activityId?: string, type?: 'success' | 'error' | 'info'} | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // --- PERSISTENCE ---
  useEffect(() => {
    localStorage.setItem('mya_dynamics_schedule', JSON.stringify(schedule));
    localStorage.setItem('mya_dynamics_completed', JSON.stringify(completedToday));
    localStorage.setItem('mya_dynamics_fired', JSON.stringify(firedNotifications));
    localStorage.setItem('mya_dynamics_silenced', JSON.stringify(silencedNotifications));
    localStorage.setItem('mya_dynamics_last_date', todayStr);
  }, [schedule, completedToday, firedNotifications, silencedNotifications, todayStr]);

  // --- CLOCK & TIMERS ---
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    registerServiceWorker().catch(() => {
      // Silent fail: app still works with local notifications.
    });
  }, []);

  useEffect(() => {
    syncScheduleToBackend({
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      schedule,
    }).catch(() => {
      // Keep app usable even if backend is temporarily unavailable.
    });
  }, [schedule]);

  useEffect(() => {
    syncNotificationHours(notificationHourStart, notificationHourEnd).catch(() => {
      // Keep app usable even if backend is temporarily unavailable.
    });
  }, [notificationHourStart, notificationHourEnd]);

  // --- NOTIFICATION LOGIC (90, 30, 10 min) ---
  useEffect(() => {
    if (!notificationsEnabled) return;

    const checkNotifications = () => {
      const today = schedule[activeDayIndex];
      const nowH = currentTime.getHours();
      const nowM = currentTime.getMinutes();
      const nowTotal = nowH * 60 + nowM;

      today.activities.forEach(activity => {
        if (silencedNotifications[activity.id] || completedToday[activity.id]) return;

        const [startH, startM] = activity.startTime.split(':').map(Number);
        const startTotal = startH * 60 + startM;
        const diff = startTotal - nowTotal;

        // Windows for notification
        const windows = [90, 30, 10];
        windows.forEach(min => {
          const key = `${activity.id}_${min}`;
          if (diff === min && !firedNotifications[key]) {
            let message = `Faltan ${min} minutos para: ${activity.name}`;
            
            // Special message for Labs at 90 min
            if (min === 90 && activity.name.toLowerCase().includes('lab')) {
              message = `Aviso Preventivo: Prepárate para tu clase de ${activity.name}. Tienes 90 minutos.`;
            }

            setNotification({
              title: min === 90 && activity.name.toLowerCase().includes('lab') ? 'Preparación Lab' : `Aviso: ${min} min`,
              message: message,
              activityId: activity.id
            });
            setFiredNotifications(prev => ({ ...prev, [key]: true }));
            // In a real Android environment, check Notification API
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(`Aviso: ${activity.name}`, { body: `Faltan ${min} minutos.` });
            }
          }
        });
      });
    };

    checkNotifications();
  }, [currentTime, activeDayIndex, schedule, notificationsEnabled, completedToday, firedNotifications, silencedNotifications]);

  const timeStr = useMemo(() => {
    return currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }, [currentTime]);

  const currentActivity = useMemo(() => {
    const currentDay = schedule[activeDayIndex];
    return currentDay.activities.find(a => {
      if (completedToday[a.id]) return false;
      const [startH, startM] = a.startTime.split(':').map(Number);
      const [endH, endM] = a.endTime.split(':').map(Number);
      const nowH = currentTime.getHours();
      const nowM = currentTime.getMinutes();
      const startT = startH * 60 + startM;
      const endT = endH * 60 + endM;
      const nowT = nowH * 60 + nowM;
      return nowT >= startT && nowT < endT;
    });
  }, [currentTime, activeDayIndex, schedule, completedToday]);

  const nextActivity = useMemo(() => {
    const currentDay = schedule[activeDayIndex];
    return currentDay.activities.find(a => {
      if (completedToday[a.id]) return false;
      const [startH, startM] = a.startTime.split(':').map(Number);
      const nowH = currentTime.getHours();
      const nowM = currentTime.getMinutes();
      return (startH * 60 + startM) > (nowH * 60 + nowM);
    });
  }, [currentTime, activeDayIndex, schedule, completedToday]);

  const progressToday = useMemo(() => {
    const today = schedule[activeDayIndex];
    if (today.activities.length === 0) return 0;
    const completed = today.activities.filter(a => completedToday[a.id]).length;
    return Math.round((completed / today.activities.length) * 100);
  }, [schedule, activeDayIndex, completedToday]);

  // --- HANDLERS ---
  const markAsCompleted = (activityId: string) => {
    setCompletedToday(prev => ({ ...prev, [activityId]: true }));
    setNotification({ title: '✅ ¡Completada!', message: 'Actividad archivada por hoy.', type: 'success' });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleEnableNotifications = async () => {
    try {
      setPushError(null);

      if (!('Notification' in window)) {
        throw new Error('Este navegador no soporta notificaciones.');
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setNotificationsEnabled(false);
        setPushConfigured(false);
        setNotification({ title: '⚠️ Permiso requerido', message: 'Debes aceptar notificaciones para activar avisos en segundo plano.', type: 'error' });
        setTimeout(() => setNotification(null), 4000);
        return;
      }

      const registration = await registerServiceWorker();
      if (!registration || !('PushManager' in window)) {
        throw new Error('Push API no disponible en este dispositivo.');
      }

      const subscription = await subscribeToPush(registration);
      await syncSubscriptionToBackend({
        subscription,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        schedule,
      });

      setNotificationsEnabled(true);
      setPushConfigured(true);
      setNotification({ title: '🔔 Push Activado', message: 'Notificaciones activas incluso con la app cerrada.', type: 'success' });
      setTimeout(() => setNotification(null), 3500);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'No se pudo activar push.';
      setPushError(msg);
      setNotificationsEnabled(false);
      setPushConfigured(false);
      setNotification({ title: '❌ Error de Push', message: msg, type: 'error' });
      setTimeout(() => setNotification(null), 4500);
    }
  };

  const handleSendTestPush = async () => {
    try {
      await sendTestPush();
      setNotification({ title: '📨 Prueba Enviada', message: 'Revisa la notificación en tu teléfono.', type: 'info' });
      setTimeout(() => setNotification(null), 3000);
    } catch {
      setNotification({ title: '⚠️ Backend Offline', message: 'No se pudo enviar la prueba de notificación.', type: 'error' });
      setTimeout(() => setNotification(null), 3500);
    }
  };

  const handleSaveActivity = () => {
    const { name, start, end, emoji } = editorData;
    if (!name.trim()) return;

    setSchedule(prev => {
      const copy = [...prev];
      let activities = [...copy[activeDayIndex].activities];

      if (showEditor?.mode === 'edit' && showEditor.activityId) {
        activities = activities.map(a => 
          a.id === showEditor.activityId 
            ? { ...a, name: name.trim(), startTime: start, endTime: end, emoji } 
            : a
        );
      } else {
        const newAct: Activity = {
          id: `manual-${Date.now()}`,
          name: name.trim(),
          startTime: start,
          endTime: end,
          category: Category.SPECIAL,
          emoji
        };
        activities.push(newAct);
      }

      activities.sort((a, b) => a.startTime.localeCompare(b.startTime));
      copy[activeDayIndex] = { ...copy[activeDayIndex], activities };
      return copy;
    });

    setNotification({ 
      title: showEditor?.mode === 'edit' ? '✅ Actualizado' : '✅ Añadida', 
      message: `${name} guardado.`,
      type: 'success'
    });
    setShowEditor(null);
    setEditorData({ name: '', start: '12:00', end: '13:00', emoji: '📍' });
    setTimeout(() => setNotification(null), 3000);
  };

  const openEditor = (mode: 'add' | 'edit', activity?: Activity) => {
    if (mode === 'edit' && activity) {
      setEditorData({
        name: activity.name,
        start: activity.startTime,
        end: activity.endTime,
        emoji: activity.emoji || '📍'
      });
      setShowEditor({ mode: 'edit', activityId: activity.id });
    } else {
      setEditorData({ name: '', start: '12:00', end: '13:00', emoji: '📍' });
      setShowEditor({ mode: 'add' });
    }
  };

  const replaceActivity = (dayIndex: number, oldActivityId: string, newActivityName: string | null, category?: Category, emoji?: string) => {
    setSchedule(prev => {
      const copy = [...prev];
      const day = { ...copy[dayIndex] };
      const activityIndex = day.activities.findIndex(a => a.id === oldActivityId);
      
      if (activityIndex !== -1) {
        if (newActivityName === null) {
          day.activities = day.activities.filter(a => a.id !== oldActivityId);
          setNotification({ title: 'Eliminado', message: 'Actividad removida.' });
        } else {
          const old = day.activities[activityIndex];
          day.activities[activityIndex] = {
            ...old,
            name: newActivityName,
            category: category!,
            emoji: emoji,
            id: `${newActivityName}-${Date.now()}`
          };
          setNotification({ title: 'Actualizado', message: `Nueva actividad: ${newActivityName}` });
        }
      }
      
      copy[dayIndex] = day;
      return copy;
    });
    
    setTimeout(() => setNotification(null), 3000);
  };

  const getCategoryColor = (category: Category) => {
    switch (category) {
      case Category.ACADEMIC: return 'bg-indigo-50 border-indigo-200 text-indigo-700';
      case Category.WELLNESS: return 'bg-rose-50 border-rose-200 text-rose-700';
      case Category.CREATIVE: return 'bg-amber-50 border-amber-200 text-amber-700';
      case Category.TECH_DEV: return 'bg-emerald-50 border-emerald-200 text-emerald-700';
      case Category.TRAINING: return 'bg-purple-50 border-purple-200 text-purple-700';
      case Category.SPECIAL: return 'bg-sky-50 border-sky-200 text-sky-700';
      default: return 'bg-slate-50 border-slate-200 text-slate-700';
    }
  };

  return (
    <div className="min-h-screen font-sans p-4 pb-24 md:p-8 selection:bg-rose-100 safe-top">
      <div className="max-w-xl mx-auto space-y-6 pt-[env(safe-area-inset-top)]">
        
        {/* Header */}
        <header className="flex flex-col gap-3 paper-card sketch-border p-5 pt-8 bg-white relative">
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-6 bg-rose-200/50 -rotate-2 sketch-border" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 paper-card sketch-border bg-indigo-100 flex items-center justify-center text-indigo-600 rotate-3">
                <Star className="w-6 h-6 fill-indigo-600" />
              </div>
              <div>
                <h1 className="font-hand font-bold text-3xl tracking-tight text-indigo-900 leading-none">Mya Dynamics</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 highlighter-yellow">{schedule[activeDayIndex].day}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-rose-500 font-mono">{timeStr}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleEnableNotifications}
                className={`p-3 sketch-border border-2 rounded-lg transition ${notificationsEnabled ? 'bg-indigo-100 border-indigo-900 text-indigo-900' : 'bg-slate-50 border-slate-300 text-slate-400'}`}
              >
                {notificationsEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
              </button>
              <button
                onClick={() => setShowNotificationHoursModal(true)}
                className="p-3 sketch-border border-2 rounded-lg bg-yellow-100 border-yellow-900 text-yellow-900 hover:bg-yellow-200 transition font-bold flex items-center gap-2"
                title="Configurar horas de notificaciones"
              >
                <Settings className="w-5 h-5" />
                <span className="text-xs hidden sm:inline">Config</span>
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard / Quick Progress */}
        <section className="paper-card sketch-border p-6 bg-white relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-50 rounded-full blur-3xl opacity-50" />
          <div className="flex items-center justify-between mb-4 relative z-10">
            <h3 className="font-hand text-xl font-bold text-indigo-900">Tu Ritmo</h3>
            <span className="text-xs font-mono font-bold text-indigo-500">{progressToday}% listo</span>
          </div>
          <div className="w-full h-3 bg-slate-50 border-2 border-indigo-900 rounded-full overflow-hidden mb-8 relative z-10">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progressToday}%` }}
              className="h-full bg-indigo-500"
            />
          </div>

          <div className="flex items-center justify-between gap-4 relative z-10">
            <div className="flex-1">
              <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">En curso</span>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{currentActivity?.emoji || '🍵'}</span>
                <span className="font-bold text-lg truncate font-hand text-indigo-900 leading-tight">
                  <span className="highlighter-rose">{currentActivity?.name || 'Recargando...'}</span>
                </span>
              </div>
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <div className="flex-1">
              <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Lo que sigue</span>
              <div className="flex items-center gap-3">
                <span className="text-2xl opacity-50">{nextActivity?.emoji || '✨'}</span>
                <span className="font-bold text-sm truncate text-slate-500 font-hand text-lg opacity-60">
                  {nextActivity?.name || 'Fin de jornada'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3 relative z-10">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              {pushConfigured ? 'Push backend: activo' : 'Push backend: pendiente'}
            </span>
            <button
              onClick={handleSendTestPush}
              className="px-3 py-2 text-xs border-2 border-indigo-900 bg-white text-indigo-900 rounded-xl font-bold disabled:opacity-50"
              disabled={!pushConfigured}
            >
              Probar push
            </button>
          </div>

          {pushError && (
            <p className="mt-2 text-[11px] text-rose-600 font-semibold relative z-10">{pushError}</p>
          )}
        </section>

        {/* Day Selector */}
        <nav className="flex justify-between items-center gap-1 p-2 bg-slate-100/50 sketch-border border-2 border-slate-200">
          {schedule.map((day, idx) => (
            <button
              key={day.day}
              onClick={() => setActiveDayIndex(idx)}
              className={`flex-1 py-3 rounded-xl transition-all font-hand font-bold text-xl relative ${
                activeDayIndex === idx 
                  ? 'text-indigo-900' 
                  : 'text-slate-400 hover:text-indigo-900'
              }`}
            >
              <span className="relative z-10">{day.day.substring(0, 1)}</span>
              {activeDayIndex === idx && (
                <motion.div 
                  layoutId="activeDay"
                  className="absolute inset-0 bg-white border-2 border-indigo-950 sketch-border shadow-sm"
                />
              )}
            </button>
          ))}
        </nav>

        {/* Schedule List Container */}
        <div 
          onClick={() => openEditor('add')}
          className="space-y-4 min-h-[60vh] pb-24 cursor-pointer"
        >
          <div onClick={(e) => e.stopPropagation()}>
            <AnimatePresence mode="popLayout" initial={false}>
              {schedule[activeDayIndex].activities
                .filter(activity => !completedToday[activity.id])
                .map((activity) => (
                  <DraggableActivity 
                    key={activity.id} 
                    activity={activity} 
                    onEdit={() => openEditor('edit', activity)}
                    onComplete={() => markAsCompleted(activity.id)}
                    colorClass={getCategoryColor(activity.category)}
                  />
              ))}
            </AnimatePresence>
          </div>
          
          {schedule[activeDayIndex].activities.filter(a => !completedToday[a.id]).length === 0 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <p className="font-bold text-slate-400">¡Día completado!</p>
              <p className="text-xs text-slate-300">Has liquidado todos tus bloques de hoy.</p>
            </motion.div>
          )}
        </div>

        {/* Global Floating Add Button */}
        <button 
          onClick={(e) => { e.stopPropagation(); openEditor('add'); }}
          className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-900 border-2 border-indigo-950 rounded-full shadow-[6px_6px_0px_#1a1a1a] flex items-center justify-center text-white active:scale-90 transition-all z-[100]"
        >
          <Plus className="w-8 h-8" />
        </button>

        {/* Activity Editor Modal */}
        <AnimatePresence>
          {showEditor && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[110] flex items-center justify-center p-6"
              onClick={() => setShowEditor(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="paper-card sketch-border w-full max-w-sm p-8 bg-white space-y-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center">
                  <h3 className="font-hand text-2xl font-bold text-indigo-900">
                    {showEditor.mode === 'edit' ? 'Editar Actividad' : 'Nueva Actividad'}
                  </h3>
                  <button onClick={() => setShowEditor(null)} className="p-2 border-2 border-slate-200 rounded-lg"><X className="w-4 h-4" /></button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-2">¿Cómo se llama la tarea?</label>
                    <input 
                      autoFocus
                      type="text"
                      className="w-full bg-slate-50 border-2 border-indigo-950 p-4 rounded-xl focus:outline-none font-hand text-2xl"
                      value={editorData.name}
                      onChange={(e) => setEditorData(prev => ({ ...prev, name: e.target.value }))}
                    />
                    
                    <div className="flex flex-wrap gap-2 pt-2">
                       {OPTIONS_CATALOG.REPLACEMENTS.map((opt, i) => (
                         <button 
                            key={i} 
                            onClick={() => setEditorData(prev => ({ ...prev, name: opt.name, emoji: opt.emoji }))}
                            className="px-3 py-1 bg-white border-2 border-slate-200 rounded-full text-xs font-hand font-bold hover:border-indigo-400"
                         >
                           {opt.emoji} {opt.name}
                         </button>
                       ))}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Inicio</label>
                      <input 
                        type="time"
                        className="w-full bg-slate-50 border-2 border-indigo-900 p-4 rounded-xl focus:outline-none font-mono font-bold"
                        value={editorData.start}
                        onChange={(e) => setEditorData(prev => ({ ...prev, start: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Fin</label>
                      <input 
                        type="time"
                        className="w-full bg-slate-50 border-2 border-indigo-900 p-4 rounded-xl focus:outline-none font-mono font-bold"
                        value={editorData.end}
                        onChange={(e) => setEditorData(prev => ({ ...prev, end: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleSaveActivity}
                  disabled={!editorData.name.trim()}
                  className="w-full py-4 bg-indigo-900 text-white font-hand text-xl rounded-xl shadow-[4px_4px_0px_#1a1a1a] active:scale-95 transition-all disabled:opacity-50"
                >
                  {showEditor.mode === 'edit' ? 'Guardar Cambios' : 'Agendar'}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toast Notification */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ y: 50, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 50, opacity: 0, scale: 0.9 }}
              className={`fixed bottom-8 left-6 right-6 paper-card text-white p-5 sketch-border z-[150] flex items-center gap-4 shadow-2xl ${
                notification.type === 'error' ? 'bg-gradient-to-r from-red-500 to-red-600' :
                notification.type === 'success' ? 'bg-gradient-to-r from-green-500 to-green-600' :
                notification.type === 'info' ? 'bg-gradient-to-r from-blue-500 to-blue-600' :
                'bg-gradient-to-r from-rose-500 to-rose-600'
              }`}
            >
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shrink-0 animate-pulse">
                {notification.type === 'error' ? (
                  <X className="w-6 h-6 text-red-600 font-bold" />
                ) : notification.type === 'success' ? (
                  <CheckCircle2 className="w-6 h-6 text-green-600 font-bold" />
                ) : (
                  <Bell className="w-6 h-6 text-rose-600 font-bold" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-hand text-lg font-bold leading-tight text-white drop-shadow-lg">{notification.title}</p>
                <p className="text-sm text-white/90 font-semibold drop-shadow-md">{notification.message}</p>
              </div>
              <button 
                onClick={() => setNotification(null)} 
                className="text-white hover:text-white/70 transition"
              >
                <X className="w-5 h-5 font-bold" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notification Hours Modal */}
        <AnimatePresence>
          {showNotificationHoursModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNotificationHoursModal(false)}
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white border-4 border-indigo-900 rounded-2xl p-6 max-w-sm w-full sketch-border"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-hand text-2xl font-bold text-indigo-900">Horario de Notificaciones</h2>
                  <button
                    onClick={() => setShowNotificationHoursModal(false)}
                    className="p-2 hover:bg-slate-100 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Hora de Inicio (0-23)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="23"
                      value={notificationHourStart}
                      onChange={(e) => setNotificationHourStart(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))}
                      className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg font-mono font-bold focus:outline-none focus:border-indigo-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Hora de Fin (0-23)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="23"
                      value={notificationHourEnd}
                      onChange={(e) => setNotificationHourEnd(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))}
                      className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg font-mono font-bold focus:outline-none focus:border-indigo-900"
                    />
                  </div>

                  <div className="bg-indigo-50 border-2 border-indigo-200 rounded-lg p-3 text-sm text-indigo-900">
                    <p>🔔 Recibirás notificaciones entre las <strong>{notificationHourStart}:00</strong> y <strong>{notificationHourEnd}:00</strong></p>
                  </div>

                  <button
                    onClick={() => setShowNotificationHoursModal(false)}
                    className="w-full bg-indigo-900 hover:bg-indigo-800 text-white font-bold py-2 px-4 rounded-lg sketch-border border-2 border-indigo-900 transition"
                  >
                    Guardar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      <style>{`
        .glass {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(25px);
          -webkit-backdrop-filter: blur(25px);
          border: 1px solid rgba(255, 255, 255, 0.4);
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .pb-safe {
          padding-bottom: env(safe-area-inset-bottom);
        }
      `}</style>
    </div>
  );
}

interface DraggableActivityProps {
  activity: Activity;
  onEdit: () => void;
  onComplete: () => void;
  colorClass: string;
}

const DraggableActivity: React.FC<DraggableActivityProps> = ({ activity, onEdit, onComplete, colorClass }) => {
  const x = useMotionValue(0);
  const background = useTransform(x, [0, 100], ['rgba(255,255,255,0)', 'rgba(74, 222, 128, 0.2)']);
  const checkOpacity = useTransform(x, [0, 80, 100], [0, 0.5, 1]);
  const scale = useTransform(x, [0, 100], [1, 1.02]);
  
  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x > 140) {
      onComplete();
    }
  };

  return (
    <div className="relative group">
      {/* Background feedback for swipe */}
      <motion.div 
        style={{ background, opacity: checkOpacity }}
        className="absolute inset-0 rounded-2xl flex items-center justify-start pl-8"
      >
        <CheckCircle2 className="w-8 h-8 text-green-500" />
      </motion.div>

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 200 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        onClick={onEdit}
        style={{ x, scale }}
        className={`relative paper-card sketch-border p-5 bg-white cursor-grab active:cursor-grabbing transition-colors`}
      >
        <div className="flex items-center gap-5">
          <div className="flex flex-col items-center min-w-[50px] opacity-40">
            <span className="text-[10px] font-bold font-mono tracking-tighter">{activity.startTime}</span>
            <div className="w-px h-5 bg-indigo-200/50 my-1" />
            <span className="text-[10px] font-bold font-mono tracking-tighter">{activity.endTime}</span>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-[0.1em] border ${colorClass}`}>
                {activity.category}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{activity.emoji}</span>
              <h3 className="font-hand font-bold text-2xl leading-tight text-slate-800">{activity.name}</h3>
            </div>
          </div>

          <div className="p-3 text-slate-200 group-hover:text-indigo-300 transition-colors">
            <ChevronRight className="w-5 h-5" />
          </div>
        </div>
      </motion.div>
    </div>
  );
};

interface CategoryGroupProps {
  title: string;
  options: any[];
  onSelect: (opt: any) => void;
}

const CategoryGroup: React.FC<CategoryGroupProps> = ({ title, options, onSelect }) => {
  return (
    <div>
      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-300 mb-3">{title}</h4>
      <div className="flex flex-wrap gap-2">
        {options.map((opt, i) => (
          <button
            key={i}
            onClick={() => onSelect(opt)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/80 rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-300 hover:bg-indigo-50 transition-all active:scale-95"
          >
            <span className="text-base">{opt.emoji}</span>
            <span className="text-xs font-bold text-slate-600">{opt.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
