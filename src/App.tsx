/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, ReactNode, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { 
  Calendar, 
  Clock, 
  Menu,
  ChevronLeft,
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
  Settings,
  AlertTriangle,
  ListTodo,
  GraduationCap,
  CheckSquare,
  CirclePlus,
} from 'lucide-react';
import { 
  INITIAL_SCHEDULE, 
  DaySchedule, 
  Activity, 
  Category, 
  ActivityType,
  OPTIONS_CATALOG 
} from './constants';
import {
  registerServiceWorker,
  subscribeToPush,
  syncScheduleToBackend,
  syncSubscriptionToBackend,
  sendTestPush,
  syncNotificationHours,
  scheduleNewNotification,
  loadCoursesFromBackend,
  syncCoursesToBackend,
  saveCourseChecklistToBackend,
  playNotificationSound,
  setupServiceWorkerMessageListener,
} from './push';
import {
  shouldHideFixedActivity,
  canCompleteBySwipe,
  getActivityBarColor,
  getCategoryBadgeColor,
  getActivityStatus,
  shouldDimActivity,
} from './utils/activityHelpers';
import { onAuthStateChange, signOut, User as SupabaseUser, supabase } from './services/supabaseAuth';
import { WelcomeScreen } from './components/WelcomeScreen';
import { Onboarding } from './components/Onboarding';
import {
  loadUserScheduleFromSupabase,
  saveUserScheduleToSupabase,
  loadUserSettingsFromSupabase,
  saveUserSettingsToSupabase,
  saveUserExceptionToSupabase,
  loadUserExceptionsForWeek,
  applyWeeklyExceptionsToSchedule,
} from './services/userDataService';

type DrawerView = 'horario' | 'mis-cursos';

type CourseTaskItem = {
  id: string;
  text: string;
  done: boolean;
};

type CourseCard = {
  courseCode: string;
  title: string;
  emoji: string;
  category: Category;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  blocks: Array<{ day: string; startTime: string; endTime: string }>;
  checklist: CourseTaskItem[];
};

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
  const [pushActivo, setPushActivo] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [notificationHourStart, setNotificationHourStart] = useState(7);
  const [notificationHourEnd, setNotificationHourEnd] = useState(22);
  const [showNotificationHoursModal, setShowNotificationHoursModal] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerView, setDrawerView] = useState<DrawerView>('horario');
  const [selectedCourseCode, setSelectedCourseCode] = useState<string | null>(null);
  const [courseChecklists, setCourseChecklists] = useState<Record<string, CourseTaskItem[]>>({});
  const [newCourseTask, setNewCourseTask] = useState('');
  const [courseSyncStatus, setCourseSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [showEditor, setShowEditor] = useState<{ mode: 'add' | 'edit', activityId?: string } | null>(null);
  const [editorData, setEditorData] = useState({ name: '', start: '12:00', end: '13:00', emoji: '📍', isCourseMarked: false, customColor: '', activityType: ActivityType.FLEXIBLE });
  const DEFAULT_PALETTE = ['#6B213F', '#8B5E83', '#4C6A92', '#29434E', '#7C3AED', '#B91C1C', '#0EA5A4', '#0EA5F5', '#FB923C', '#EF4444', '#334155', '#1F2937', '#F97316', '#F43F5E', '#022C43', '#ffffff'];
  const [notification, setNotification] = useState<{title: string, message: string, activityId?: string, type?: 'success' | 'error' | 'info'} | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [conflictModal, setConflictModal] = useState<{ title: string; message: string; suggestion: string; suggestionStart: string; suggestionEnd: string; start: string; end: string } | null>(null);
  const [checklistText, setChecklistText] = useState('');
  const [adjustableActivityModal, setAdjustableActivityModal] = useState<{ activityType: string; activityName: string } | null>(null);
  const [adjustableActivityDecision, setAdjustableActivityDecision] = useState<{ thisWeekOnly: boolean; activityId: string } | null>(null);
  
  // --- AUTH STATE ---
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLoadingUserData, setIsLoadingUserData] = useState(false);

  const parseMinutes = (value: string) => {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const formatMinutes = (totalMinutes: number) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const getWeekMondayKey = (date = new Date()) => {
    const copy = new Date(date);
    const day = copy.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    copy.setDate(copy.getDate() + offset);
    return copy.toISOString().slice(0, 10);
  };

  const currentSystemDayIndex = () => {
    const day = new Date().getDay();
    return day === 0 ? 6 : day - 1;
  };

  const isViewingToday = activeDayIndex === currentSystemDayIndex();

  const extractCourseCode = (name: string) => {
    const codeMatch = name.match(/\bIS-\d+\b/);
    if (codeMatch) return codeMatch[0];
    const parenMatch = name.match(/\((IS-\d+)\)/);
    return parenMatch ? parenMatch[1] : null;
  };

  const stripCourseCode = (name: string) => name.replace(/\s*\(IS-\d+\)/, '').trim();

  const isActivityArchived = (activityId: string) => !!completedToday[activityId];

  const weeklyResetStorageKey = 'mya_dynamics_last_fixed_restore';

  const restoreFixedCourses = () => {
    setSchedule(prev => {
      const restored = prev.map((day, idx) => {
        const baseFixed = INITIAL_SCHEDULE[idx]?.activities.filter(activity => activity.isFixed || activity.esFijo) ?? [];
        const currentFixedMap = new Map(day.activities.filter(activity => activity.isFixed || activity.esFijo).map(activity => [activity.id, activity]));
        const currentCustom = day.activities.filter(activity => !(activity.isFixed || activity.esFijo));
        const mergedFixed = baseFixed.map(activity => currentFixedMap.get(activity.id) || activity);
        return { ...day, activities: [...mergedFixed, ...currentCustom].sort((a, b) => a.startTime.localeCompare(b.startTime)) };
      });

      localStorage.setItem('mya_dynamics_schedule', JSON.stringify(restored));
      return restored;
    });
    setCompletedToday({});
    setFiredNotifications({});
    localStorage.setItem('mya_dynamics_completed', JSON.stringify({}));
    localStorage.setItem('mya_dynamics_fired', JSON.stringify({}));
  };

  const maybeRestoreWeeklyFixedCourses = () => {
    const now = new Date();
    const isMondayAfterFive = now.getDay() === 1 && now.getHours() >= 5;
    const mondayKey = getWeekMondayKey(now);
    const lastRestoreKey = localStorage.getItem(weeklyResetStorageKey);

    if (isMondayAfterFive && lastRestoreKey !== mondayKey) {
      restoreFixedCourses();
      localStorage.setItem(weeklyResetStorageKey, mondayKey);
    }
  };

  const getNearestFreeBlock = (dayIndex: number, durationMinutes: number, desiredStart = 300, excludedActivityId?: string) => {
    const dayActivities = schedule[dayIndex].activities
      .filter(activity => !isActivityArchived(activity.id) && activity.id !== excludedActivityId)
      .map(activity => ({ ...activity, start: parseMinutes(activity.startTime), end: parseMinutes(activity.endTime) }))
      .sort((a, b) => a.start - b.start);

    const opening = 300;
    const closing = 1320;
    const gaps: { start: number; end: number; distance: number }[] = [];
    let cursor = opening;

    for (const activity of dayActivities) {
      if (activity.start - cursor >= durationMinutes) {
        gaps.push({ start: cursor, end: activity.start, distance: Math.abs(cursor - desiredStart) });
      }
      cursor = Math.max(cursor, activity.end);
    }

    if (closing - cursor >= durationMinutes) {
      gaps.push({ start: cursor, end: closing, distance: Math.abs(cursor - desiredStart) });
    }

    const bestGap = gaps.sort((left, right) => left.distance - right.distance)[0];
    return bestGap ? `${formatMinutes(bestGap.start)} - ${formatMinutes(bestGap.end)}` : '05:00 - 22:00';
  };

  const detectConflict = (
    dayIndex: number,
    start: string,
    end: string,
    currentId?: string,
    newActivityType?: ActivityType
  ) => {
    // If the new activity is FLEXIBLE, do not treat it as a conflict
    if (newActivityType === ActivityType.FLEXIBLE) return null;

    const newStart = parseMinutes(start);
    const newEnd = parseMinutes(end);
    return (
      schedule[dayIndex].activities.find(activity => {
        if (activity.id === currentId || isActivityArchived(activity.id)) return false;

        // Ignore existing FLEXIBLE activities when detecting conflicts
        if (activity.activityType === ActivityType.FLEXIBLE) return false;

        const existingStart = parseMinutes(activity.startTime);
        const existingEnd = parseMinutes(activity.endTime);
        return newStart < existingEnd && newEnd > existingStart;
      }) || null
    );
  };

  const courseCards = useMemo<CourseCard[]>(() => {
    const cards = new Map<string, CourseCard>();

    schedule.forEach(day => {
      day.activities.forEach(activity => {
        const courseCode = activity.courseId || extractCourseCode(activity.name);
        if (!courseCode) return;

        const title = stripCourseCode(activity.name);
        const existing = cards.get(courseCode);
        const checklist = courseChecklists[courseCode] || [];
        const nextCard: CourseCard = existing || {
          courseCode,
          title,
          emoji: activity.emoji || '📘',
          category: activity.category,
          dayOfWeek: day.day,
          startTime: activity.startTime,
          endTime: activity.endTime,
          blocks: [],
          checklist,
        };

        nextCard.emoji = nextCard.emoji || activity.emoji || '📘';
        nextCard.blocks.push({ day: day.day, startTime: activity.startTime, endTime: activity.endTime });
        nextCard.dayOfWeek = nextCard.dayOfWeek || day.day;
        nextCard.startTime = nextCard.startTime || activity.startTime;
        nextCard.endTime = nextCard.endTime || activity.endTime;
        nextCard.checklist = checklist;
        cards.set(courseCode, nextCard);
      });
    });

    return Array.from(cards.values()).sort((left, right) => left.courseCode.localeCompare(right.courseCode));
  }, [schedule, courseChecklists]);

  const selectedCourse = courseCards.find(course => course.courseCode === selectedCourseCode) || null;

  const selectedCourseTasks = selectedCourse ? (courseChecklists[selectedCourse.courseCode] || selectedCourse.checklist || []) : [];

  const persistCourseTasks = async (courseCode: string, nextTasks: CourseTaskItem[]) => {
    setCourseChecklists(prev => ({ ...prev, [courseCode]: nextTasks }));
    try {
      await saveCourseChecklistToBackend(courseCode, nextTasks, nextTasks.length > 0 && nextTasks.every(task => task.done));
    } catch (error) {
      setNotification({ title: '⚠️ Sincronización pendiente', message: 'Las tareas se guardaron localmente, pero el backend no respondió.', type: 'error' });
      setTimeout(() => setNotification(null), 3500);
    }
  };

  const addCourseTask = async () => {
    if (!selectedCourse || !newCourseTask.trim()) return;
    const nextTasks = [...selectedCourseTasks, { id: `task-${Date.now()}`, text: newCourseTask.trim(), done: false }];
    setNewCourseTask('');
    await persistCourseTasks(selectedCourse.courseCode, nextTasks);
  };

  const toggleCourseTask = async (courseCode: string, taskId: string) => {
    const nextTasks = (courseChecklists[courseCode] || []).map(task => task.id === taskId ? { ...task, done: !task.done } : task);
    await persistCourseTasks(courseCode, nextTasks);
  };

  const deleteCourseTask = async (courseCode: string, taskId: string) => {
    const nextTasks = (courseChecklists[courseCode] || []).filter(task => task.id !== taskId);
    await persistCourseTasks(courseCode, nextTasks);
  };

  // --- PERSISTENCE ---
  // --- AUTH INITIALIZATION ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        // First, check current session without causing visible re-render
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setCurrentUser(session.user as SupabaseUser);
          setIsLoadingUserData(true);
          try {
            const userSettings = await loadUserSettingsFromSupabase(session.user.id);
            const userSchedule = await loadUserScheduleFromSupabase(session.user.id);

            // Local fallback: if backend missing the flag, allow a persisted local value
            const localOnboardingFlag = typeof window !== 'undefined' && localStorage.getItem('mya_onboarding_completed') === '1';

            // Check if user needs onboarding. If either backend says completed or local flag exists, skip onboarding.
            const needsOnboarding = !(userSettings?.onboarding_completed || localOnboardingFlag);

            if (needsOnboarding) {
              setShowOnboarding(true);
            } else if (userSchedule) {
              // Load user's schedule from Supabase and apply weekly exceptions
              const weekKey = `${new Date().getFullYear()}-${String(Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 4).getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1).padStart(2, '0')}`;
              const scheduleWithExceptions = await applyWeeklyExceptionsToSchedule(session.user.id, userSchedule, weekKey);
              setSchedule(scheduleWithExceptions);
            }
          } catch (error) {
            console.error('Error loading user data:', error);
          } finally {
            setIsLoadingUserData(false);
          }
        }

        // Mark auth as ready BEFORE subscribing to changes
        setAuthReady(true);

        // Now listen for auth state changes
        const unsubscribe = onAuthStateChange(async (user, event) => {
          // Only process meaningful auth state changes to prevent unnecessary re-renders
          // Ignore TOKEN_REFRESHED, USER_UPDATED, INITIAL_SESSION which can occur on tab focus
          if (event && !['SIGNED_IN', 'SIGNED_OUT'].includes(event)) {
            return;
          }

          setCurrentUser(user);

          // Load user data from Supabase
          if (user) {
            setIsLoadingUserData(true);
            try {
              const userSettings = await loadUserSettingsFromSupabase(user.id);
              const userSchedule = await loadUserScheduleFromSupabase(user.id);

              // Local fallback: if backend missing the flag, allow a persisted local value
              const localOnboardingFlag = typeof window !== 'undefined' && localStorage.getItem('mya_onboarding_completed') === '1';

              // Check if user needs onboarding. If either backend says completed or local flag exists, skip onboarding.
              const needsOnboarding = !(userSettings?.onboarding_completed || localOnboardingFlag);

              if (needsOnboarding) {
                setShowOnboarding(true);
              } else if (userSchedule) {
                // Load user's schedule from Supabase and apply weekly exceptions
                const weekKey = `${new Date().getFullYear()}-${String(Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 4).getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1).padStart(2, '0')}`;
                const scheduleWithExceptions = await applyWeeklyExceptionsToSchedule(user.id, userSchedule, weekKey);
                setSchedule(scheduleWithExceptions);
              }
            } catch (error) {
              console.error('Error loading user data:', error);
            } finally {
              setIsLoadingUserData(false);
            }
          }

          setIsAuthLoading(false);
        });
        return unsubscribe;
      } catch (error) {
        console.error('Auth error:', error);
        setAuthReady(true); // Mark as ready even on error
        setIsAuthLoading(false);
      }
    };

    let unsubscribe: any;
    initAuth().then((unsub) => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe.unsubscribe();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('mya_dynamics_schedule', JSON.stringify(schedule));
    localStorage.setItem('mya_dynamics_completed', JSON.stringify(completedToday));
    localStorage.setItem('mya_dynamics_fired', JSON.stringify(firedNotifications));
    localStorage.setItem('mya_dynamics_silenced', JSON.stringify(silencedNotifications));
    localStorage.setItem('mya_dynamics_last_date', todayStr);

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const baseUrl = 'https://horarioapp-ows5.onrender.com';
        await fetch(`${baseUrl}/api/push/schedule`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-mya-push-token': 'mya_2026_9fJ2kL8pQw7xZr4nT6yV3bH1',
          },
          body: JSON.stringify({
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            schedule,
          }),
          signal: controller.signal,
        });
      } catch {
        // Silently fail, no retry
      }
    }, 3000);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [schedule]);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker?.ready) return;

    let cancelled = false;
    navigator.serviceWorker.ready.then(async (reg) => {
      if (cancelled) return;
      const sub = await reg.pushManager.getSubscription();
      if (cancelled) return;
      const active = !!sub?.endpoint;
      setPushActivo(active);
      if (active) setPushConfigured(true);
    }).catch(() => {
      if (!cancelled) setPushActivo(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // --- CLOCK & TIMERS ---
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    maybeRestoreWeeklyFixedCourses();
  }, [currentTime]);

  useEffect(() => {
    if ((import.meta as ImportMeta & { env?: any }).env && (import.meta as ImportMeta & { env?: any }).env.PROD) {
      registerServiceWorker().catch(() => {
        // Silent fail: app still works with local notifications.
      });
    }
  }, []);

  // Setup Service Worker message listener for sound notifications
  useEffect(() => {
    if ((import.meta as ImportMeta & { env?: any }).env && (import.meta as ImportMeta & { env?: any }).env.PROD) {
      setupServiceWorkerMessageListener(({ soundTag, isExercise }) => {
        playNotificationSound(soundTag, isExercise);
      });
    }
  }, []);

  useEffect(() => {
    const hydrateCourses = async () => {
      try {
        const payload = courseCards.map(course => ({
          courseCode: course.courseCode,
          name: course.title,
          category: course.category,
          dayOfWeek: course.dayOfWeek,
          startTime: course.startTime,
          endTime: course.endTime,
          esFijo: true,
          isExercise: course.emoji === '💪',
          emoji: course.emoji,
          checklist: courseChecklists[course.courseCode] || course.checklist || [],
          completed: (courseChecklists[course.courseCode] || []).length > 0 && (courseChecklists[course.courseCode] || []).every(task => task.done),
        }));

        if (payload.length > 0) {
          setCourseSyncStatus('syncing');
          await syncCoursesToBackend({ courses: payload });
          const response = await loadCoursesFromBackend();
          const nextCourseMap: Record<string, CourseTaskItem[]> = {};
          const loadedCourses = response?.courses || [];

          loadedCourses.forEach((course: any) => {
            nextCourseMap[course.courseCode] = (course.checklist || []).map((item: any, index: number) => ({
              id: item.id || `task-${index}`,
              text: item.text || String(item),
              done: !!item.done,
            }));
          });

          if (Object.keys(nextCourseMap).length > 0) {
            setCourseChecklists(prev => ({ ...nextCourseMap, ...prev }));
          }
          setCourseSyncStatus('idle');
        }
      } catch (error) {
        setCourseSyncStatus('error');
      }
    };

    hydrateCourses();
  }, [courseCards.length]);

  // Setup audio and service worker message listener for playing sound
  useEffect(() => {
    // create audio element once
    if (!audioRef.current) {
      try {
        audioRef.current = new Audio('/magic.wav');
        audioRef.current.preload = 'auto';
        audioRef.current.volume = 0.7;
      } catch (e) {
        audioRef.current = null;
      }
    }

    const onMessage = (ev: MessageEvent) => {
      try {
        const data = ev.data;
        if (data && data.type === 'play-sound' && audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
        }
      } catch (err) {
        // ignore
      }
    };

    if (navigator.serviceWorker && navigator.serviceWorker.addEventListener) {
      navigator.serviceWorker.addEventListener('message', onMessage as any);
    }

    return () => {
      try {
        if (navigator.serviceWorker && navigator.serviceWorker.removeEventListener) {
          navigator.serviceWorker.removeEventListener('message', onMessage as any);
        }
      } catch (e) {
        // ignore
      }
    };
  }, []);

  useEffect(() => {
    scheduleNewNotification({
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      schedule,
    }).catch(() => {
      // Keep app usable even if backend is temporarily unavailable.
    });
  }, [schedule]);

  useEffect(() => {
    syncNotificationHours(notificationHourStart, notificationHourEnd, currentUser?.id).catch(() => {
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
            // play local sound when app is open
            try {
              if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(() => {});
              }
            } catch {}
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
    setNotification({ title: '✅ Quitada', message: 'La actividad salió del horario y ya no bloquea conflictos hoy.', type: 'success' });
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
        userId: currentUser?.id,
      });

      setNotificationsEnabled(true);
      setPushConfigured(true);
      setPushActivo(true);
      setNotification({ title: '🔔 Push Activado', message: 'Notificaciones activas incluso con la app cerrada.', type: 'success' });
      setTimeout(() => setNotification(null), 3500);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'No se pudo activar push.';
      setPushError(msg);
      setNotificationsEnabled(false);
      setPushConfigured(false);
      setPushActivo(false);
      setNotification({ title: '❌ Error de Push', message: msg, type: 'error' });
      setTimeout(() => setNotification(null), 4500);
    }
  };

  const handleSendTestPush = async () => {
    try {
      await sendTestPush(currentUser?.id);
      setNotification({ title: '📨 Prueba Enviada', message: 'Revisa la notificación en tu teléfono.', type: 'info' });
      setTimeout(() => setNotification(null), 3000);
    } catch {
      setNotification({ title: '⚠️ Backend Offline', message: 'No se pudo enviar la prueba de notificación.', type: 'error' });
      setTimeout(() => setNotification(null), 3500);
    }
  };

  // Helper: Generate week key in YYYY-WW format
  const getWeekKey = (date: Date = new Date()): string => {
    const year = date.getFullYear();
    const jan4 = new Date(year, 0, 4);
    const monday = new Date(jan4);
    monday.setDate(monday.getDate() - monday.getDay() + 1);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay() + 1);
    const diff = weekStart.getTime() - monday.getTime();
    const week = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
    return `${year}-${String(week).padStart(2, '0')}`;
  };

  // Helper: Save weekly exception for FIJA_AJUSTABLE activities
  const saveWeeklyException = async (activityId: string, modifiedData: any) => {
    if (!currentUser) return;
    try {
      const weekKey = getWeekKey();
      await saveUserExceptionToSupabase(currentUser.id, weekKey, activityId, modifiedData);
      console.log('[Exception] Guardada para semana', weekKey);
    } catch (error) {
      console.error('Error saving weekly exception:', error);
    }
  };

  const handleSaveActivity = () => {
    const { name, start, end, emoji, isCourseMarked, customColor } = editorData;
    const isValidHex = (c?: string) => !!c && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c.trim());
    const chosenColor = isValidHex(customColor) ? customColor!.trim() : DEFAULT_PALETTE[0];
    if (!name.trim()) return;

    const checklist = checklistText
      .split(/[\n,]/)
      .map(item => item.trim())
      .filter(Boolean);

    // Check if we're editing a FIJA_AJUSTABLE activity
    if (showEditor?.mode === 'edit' && showEditor.activityId) {
      const currentActivity = schedule[activeDayIndex].activities.find(a => a.id === showEditor.activityId);
      if (currentActivity?.activityType === ActivityType.FIJA_AJUSTABLE) {
        // Check if time changed and if we haven't already made a decision
        if ((currentActivity.startTime !== start || currentActivity.endTime !== end) && !adjustableActivityDecision) {
          // Show modal for weekly exception
          setAdjustableActivityModal({
            activityType: ActivityType.FIJA_AJUSTABLE,
            activityName: name,
          });
          return;
        }
      }
    }

    // In edit mode, only check conflict if the time actually changed
    let shouldCheckConflict = true;
    if (showEditor?.mode === 'edit' && showEditor.activityId) {
      const currentActivity = schedule[activeDayIndex].activities.find(a => a.id === showEditor.activityId);
      if (currentActivity && currentActivity.startTime === start && currentActivity.endTime === end) {
        shouldCheckConflict = false; // Only name/emoji changed, skip conflict check
      }
    }

    const conflict = shouldCheckConflict
      ? detectConflict(
          activeDayIndex,
          start,
          end,
          showEditor?.mode === 'edit' ? showEditor.activityId : undefined,
          editorData.activityType
        )
      : null;
    if (conflict) {
      const duration = parseMinutes(end) - parseMinutes(start);
      const suggestion = getNearestFreeBlock(activeDayIndex, duration, parseMinutes(start), showEditor?.activityId);
      const [suggestionStart, suggestionEnd] = suggestion.split(' - ');
      setConflictModal({
        title: 'Conflicto de horario detectado',
        message: `${name.trim()} choca con ${conflict.name} (${conflict.startTime} - ${conflict.endTime}).`,
        suggestion: `Tiempo libre más cercano: ${suggestion}`,
        suggestionStart,
        suggestionEnd,
        start,
        end,
      });
      return;
    }

    setSchedule(prev => {
      const copy = [...prev];
      let activities = [...copy[activeDayIndex].activities];

      if (showEditor?.mode === 'edit' && showEditor.activityId) {
        activities = activities.map(a => 
          a.id === showEditor.activityId 
            ? { 
                ...a, 
                name: name.trim(), 
                startTime: start, 
                endTime: end, 
                emoji, 
                checklist, 
                courseId: a.courseId || a.id, 
                isCourseMarked, 
                customColor: isValidHex(customColor) ? customColor : a.customColor,
                activityType: editorData.activityType // Use the updated activity type from editor
              } 
            : a
        );
      } else {
        const newAct: Activity = {
          id: `manual-${Date.now()}`,
          name: name.trim(),
          startTime: start,
          endTime: end,
          category: Category.SPECIAL,
          emoji,
          courseId: `manual-${Date.now()}`,
          checklist,
          isCourseMarked,
          customColor: chosenColor,
          activityType: ActivityType.FLEXIBLE, // New activities default to FLEXIBLE
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
    
    // Handle weekly exceptions for FIJA_AJUSTABLE activities
    if (adjustableActivityDecision?.thisWeekOnly && currentUser) {
      const modifiedData = {
        startTime: start,
        endTime: end,
        name: name.trim(),
        emoji,
      };
      saveWeeklyException(adjustableActivityDecision.activityId, modifiedData);
      setNotification({
        title: '📅 Solo esta semana',
        message: `${name} cambió solo para esta semana.`,
        type: 'info'
      });
    } else if (adjustableActivityDecision) {
      setNotification({
        title: '✅ Cambio permanente',
        message: `${name} cambió permanentemente.`,
        type: 'success'
      });
    }
    
    setShowEditor(null);
    setAdjustableActivityDecision(null);
    setEditorData({ name: '', start: '12:00', end: '13:00', emoji: '📍', isCourseMarked: false, customColor: '', activityType: ActivityType.FLEXIBLE });
    setTimeout(() => setNotification(null), 3000);
  };

  const openEditor = (mode: 'add' | 'edit', activity?: Activity) => {
    if (mode === 'edit' && activity) {
      // Check if activity is FIJA_PERMANENTE - restrict editing time
      if (activity.activityType === ActivityType.FIJA_PERMANENTE) {
        setNotification({
          title: '🔒 No editable',
          message: 'Este es un curso fijo. Solo puedes marcarlo como completado.',
          type: 'info',
        });
        return;
      }

      setEditorData({
        name: activity.name,
        start: activity.startTime,
        end: activity.endTime,
        emoji: activity.emoji || '📍',
        isCourseMarked: activity.isCourseMarked || false,
        customColor: activity.customColor || '',
        activityType: activity.activityType || ActivityType.FLEXIBLE
      });
      setChecklistText((activity.checklist || []).join('\n'));
      setShowEditor({ mode: 'edit', activityId: activity.id });
    } else {
      setEditorData({ name: '', start: '12:00', end: '13:00', emoji: '📍', isCourseMarked: false, customColor: DEFAULT_PALETTE[0], activityType: ActivityType.FLEXIBLE });
      setChecklistText('');
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

  const handleOnboardingComplete = async (onboardedSchedule: DaySchedule[]) => {
    if (!currentUser) return;

    try {
      // Save schedule and onboarding state without blocking the UI flow.
      const results = await Promise.allSettled([
        saveUserScheduleToSupabase(currentUser.id, onboardedSchedule),
        saveUserSettingsToSupabase(currentUser.id, {
          onboarding_completed: true,
          user_name: currentUser.name,
          notification_hour_start: 7,
          notification_hour_end: 22,
        }),
      ]);

      const hasSyncError = results.some((result) => result.status === 'rejected');

      // Update local state even if Supabase is temporarily unavailable.
      setSchedule(onboardedSchedule);
      setShowOnboarding(false);

      if (hasSyncError) {
        setNotification({
          title: '⚠️ Guardado local',
          message: 'Tu horario ya está listo. La sincronización con la nube quedará pendiente.',
          type: 'info',
        });
        setTimeout(() => setNotification(null), 4500);
      }
      // Persist local onboarding completed flag so reloads don't force onboarding
      try {
        if (typeof window !== 'undefined') localStorage.setItem('mya_onboarding_completed', '1');
      } catch (e) {
        // ignore
      }
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setSchedule(onboardedSchedule);
      setShowOnboarding(false);
      setNotification({
        title: '⚠️ Guardado local',
        message: 'Tu horario se aplicó en la app, pero hubo un problema al sincronizarlo.',
        type: 'info',
      });
      try {
        if (typeof window !== 'undefined') localStorage.setItem('mya_onboarding_completed', '1');
      } catch (e) {}
      setTimeout(() => setNotification(null), 4500);
    }
  };

  // Show loading or welcome screen if not authenticated
  if (isAuthLoading) {
    return <WelcomeScreen isLoading={true} />;
  }

  // Wait for initial auth check before rendering anything
  // This prevents flashing/flickering when Supabase checks session
  if (!authReady) {
    return null;
  }

  if (!currentUser) {
    return <WelcomeScreen isLoading={false} />;
  }

  // Show onboarding only when flag set and user data has finished loading.
  if (isLoadingUserData) {
    // While user data loads, show a loading state to avoid flashing the onboarding UI.
    return <WelcomeScreen isLoading={true} />;
  }

  if (showOnboarding) {
    return (
      <Onboarding
        userName={currentUser.name}
        onComplete={handleOnboardingComplete}
      />
    );
  }

  return (
    <div className="min-h-screen font-sans p-4 pb-24 md:p-8 selection:bg-rose-100 safe-top">
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/60 z-[230]"
            onClick={() => setDrawerOpen(false)}
          >
            <motion.aside
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="absolute left-0 top-0 h-full w-[86vw] max-w-sm bg-white border-r-4 border-indigo-950 p-5 pb-8 shadow-[24px_0_80px_rgba(15,23,42,0.45)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.4em] text-slate-500 font-black">Navegación</p>
                  <h2 className="font-hand text-3xl font-black text-indigo-950">Mya Dynamics</h2>
                </div>
                <button onClick={() => setDrawerOpen(false)} className="w-10 h-10 rounded-full border-2 border-slate-300 bg-white flex items-center justify-center">
                  <ChevronLeft className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => { setDrawerView('horario'); setDrawerOpen(false); }}
                  className={`w-full rounded-2xl border-2 p-4 text-left flex items-center gap-3 ${drawerView === 'horario' ? 'bg-indigo-900 text-white border-indigo-950' : 'bg-white text-indigo-950 border-indigo-200'}`}
                >
                  <Calendar className="w-5 h-5" />
                  <span className="font-black">Horario</span>
                </button>
                <button
                  onClick={() => { setDrawerView('mis-cursos'); setDrawerOpen(false); }}
                  className={`w-full rounded-2xl border-2 p-4 text-left flex items-center gap-3 ${drawerView === 'mis-cursos' ? 'bg-fuchsia-700 text-white border-fuchsia-950' : 'bg-white text-indigo-950 border-indigo-200'}`}
                >
                  <GraduationCap className="w-5 h-5" />
                  <span className="font-black">Mis Cursos</span>
                </button>
              </div>

              <div className="mt-6 space-y-3">
                <button
                  onClick={handleEnableNotifications}
                  className="w-full rounded-2xl border-2 border-amber-500 bg-amber-400 text-amber-950 p-4 flex items-center gap-3 font-black"
                >
                  <Bell className="w-5 h-5" />
                  <span>Activar campana</span>
                </button>
                <button
                  onClick={() => setShowNotificationHoursModal(true)}
                  className="w-full rounded-2xl border-2 border-slate-300 bg-white text-slate-800 p-4 flex items-center gap-3 font-bold"
                >
                  <Settings className="w-5 h-5" />
                  <span>Horas de aviso</span>
                </button>
              </div>

              <div className="mt-6 rounded-3xl border-2 border-indigo-200 bg-white p-4">
                <p className="text-[10px] uppercase tracking-[0.4em] text-slate-500 font-black">Estado</p>
                <p className="mt-2 text-sm font-bold text-indigo-950">{courseSyncStatus === 'syncing' ? 'Sincronizando cursos' : courseSyncStatus === 'error' ? 'Sincronización con errores' : 'Listo para trabajar'}</p>
                <p className="mt-1 text-xs text-slate-500">Horario fijo, cursos y checklist quedan persistidos.</p>
              </div>

              {/* User Section */}
              {currentUser && (
                <div className="mt-6 pt-6 border-t-2 border-slate-200 space-y-3">
                  <div className="flex items-center gap-3 px-3 py-2">
                    {currentUser.avatar_url ? (
                      <img 
                        src={currentUser.avatar_url} 
                        alt={currentUser.name}
                        className="w-10 h-10 rounded-full border-2 border-indigo-900"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full border-2 border-indigo-900 bg-indigo-100 flex items-center justify-center text-indigo-900 font-bold">
                        {currentUser.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-bold text-indigo-950 truncate">{currentUser.name}</p>
                      <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await signOut();
                        // Clear local onboarding marker to avoid carrying it across accounts
                        try { if (typeof window !== 'undefined') localStorage.removeItem('mya_onboarding_completed'); } catch (e) {}
                        setCurrentUser(null);
                        setDrawerOpen(false);
                      } catch (error) {
                        console.error('Sign out error:', error);
                      }
                    }}
                    className="w-full rounded-2xl border-2 border-red-500 bg-red-50 text-red-700 p-3 flex items-center justify-center gap-2 font-bold hover:bg-red-100 transition"
                  >
                    <X className="w-4 h-4" />
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              )}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

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
                  {currentUser && <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 ml-auto">👋 {currentUser.name.split(' ')[0]}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDrawerOpen(true)}
                className="p-3 sketch-border border-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition font-bold flex items-center gap-2"
                aria-label="Abrir menú lateral"
              >
                <Menu className="w-5 h-5" />
                <span className="hidden sm:inline text-xs uppercase tracking-widest">Menú</span>
              </button>
              <button 
                onClick={handleEnableNotifications}
                className={`p-3 sketch-border border-2 rounded-lg transition flex items-center gap-2 font-bold ${notificationsEnabled ? 'bg-indigo-100 border-indigo-900 text-indigo-900' : 'bg-yellow-100 border-yellow-900 text-yellow-900'}`}
              >
                {notificationsEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
                <span className="hidden sm:inline text-xs uppercase tracking-widest">{notificationsEnabled ? 'Alertas ON' : 'Activar Alertas'}</span>
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

        {/* Main view switch */}
        {drawerView === 'horario' ? (
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
              {pushActivo ? 'Push backend: activo' : 'Push backend: pendiente'}
            </span>
            <button
              onClick={handleSendTestPush}
              className="px-3 py-2 text-xs border-2 border-indigo-900 bg-white text-indigo-900 rounded-xl font-bold disabled:opacity-50"
              disabled={!pushActivo}
            >
              Probar push
            </button>
          </div>

          {pushError && (
            <p className="mt-2 text-[11px] text-rose-600 font-semibold relative z-10">{pushError}</p>
          )}
          </section>
        ) : (
          <section className="space-y-5">
            <div className="paper-card sketch-border p-5 bg-white">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-hand text-2xl font-black text-indigo-950">Mis Cursos</h3>
                  <p className="text-sm text-slate-500 font-semibold">Tarjetas persistentes con tareas sincronizadas.</p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border-2 border-fuchsia-200 bg-fuchsia-50 px-3 py-1 text-xs font-black text-fuchsia-700">
                  <CheckSquare className="w-4 h-4" />
                  {courseCards.length} cursos
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {courseCards.map(course => {
                  const total = courseChecklists[course.courseCode]?.length || course.checklist.length || 0;
                  const done = (courseChecklists[course.courseCode] || course.checklist).filter(task => task.done).length;
                  const progress = total === 0 ? 0 : Math.round((done / total) * 100);

                  return (
                    <button
                      key={course.courseCode}
                      onClick={() => setSelectedCourseCode(course.courseCode)}
                      className="text-left rounded-3xl border-2 border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)] hover:border-indigo-300 transition"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-100 via-white to-fuchsia-100 border-2 border-indigo-200 flex items-center justify-center text-3xl shrink-0">
                          {course.emoji}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400 font-black">{course.courseCode}</p>
                              <h4 className="font-hand text-2xl font-black text-indigo-950 truncate">{course.title}</h4>
                            </div>
                            <span className="rounded-full border-2 border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">{progress}%</span>
                          </div>

                          <p className="mt-2 text-sm text-slate-500 font-semibold">{course.dayOfWeek} · {course.startTime} - {course.endTime}</p>
                          <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                            <div className="h-full bg-gradient-to-r from-fuchsia-500 to-indigo-600" style={{ width: `${progress}%` }} />
                          </div>
                          <p className="mt-2 text-xs text-slate-400 font-semibold">{done}/{total || 0} tareas completadas</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {drawerView === 'horario' && (
          <>
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
                    .filter(activity => {
                      // Hide if manually completed
                      if (completedToday[activity.id]) return false;
                      
                      // Auto-hide fixed activities only on the real current day
                      if (shouldHideFixedActivity(activity, currentTime, isViewingToday)) return false;
                      
                      return true;
                    })
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
          </>
        )}

        {/* Global Floating Add Button */}
        <button 
          onClick={(e) => { e.stopPropagation(); openEditor('add'); }}
          className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-900 border-2 border-indigo-950 rounded-full shadow-[6px_6px_0px_#1a1a1a] flex items-center justify-center text-white active:scale-90 transition-all z-[100]"
        >
          <Plus className="w-8 h-8" />
        </button>

        {/* Course detail modal */}
        <AnimatePresence>
          {selectedCourse && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/70 z-[240] flex items-end md:items-center justify-center p-0 md:p-6"
              onClick={() => setSelectedCourseCode(null)}
            >
              <motion.div
                initial={{ y: 80, opacity: 0, scale: 0.98 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 80, opacity: 0, scale: 0.98 }}
                className="w-full md:max-w-2xl bg-white border-t-4 md:border-4 border-indigo-950 rounded-t-[2rem] md:rounded-[2rem] p-5 md:p-6 max-h-[88vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500 font-black">{selectedCourse.courseCode}</p>
                    <h3 className="font-hand text-3xl font-black text-indigo-950">{selectedCourse.title}</h3>
                    <p className="mt-1 text-sm text-slate-600 font-semibold">{selectedCourse.dayOfWeek} · {selectedCourse.startTime} - {selectedCourse.endTime}</p>
                  </div>
                  <button onClick={() => setSelectedCourseCode(null)} className="w-11 h-11 rounded-full border-2 border-slate-300 bg-white flex items-center justify-center shrink-0">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  {selectedCourse.blocks.map((block, index) => (
                    <div key={`${block.day}-${index}`} className="rounded-2xl border-2 border-indigo-200 bg-white p-3">
                      <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400 font-black">Bloque</p>
                      <p className="mt-1 text-sm font-black text-indigo-950">{block.day}</p>
                      <p className="text-sm text-slate-600 font-semibold">{block.startTime} - {block.endTime}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-3xl border-2 border-fuchsia-200 bg-white p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-hand text-2xl font-black text-fuchsia-800">Lista de Tareas</h4>
                    <span className="text-xs font-black text-fuchsia-600 uppercase tracking-[0.3em]">{selectedCourseTasks.filter(task => task.done).length}/{selectedCourseTasks.length || 0}</span>
                  </div>

                  <div className="space-y-3">
                    {selectedCourseTasks.map(task => (
                      <div key={task.id} className="flex items-center gap-3 rounded-2xl border-2 border-slate-200 bg-slate-50 p-3">
                        <button
                          onClick={() => toggleCourseTask(selectedCourse.courseCode, task.id)}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${task.done ? 'bg-emerald-500 border-emerald-600 text-white' : 'bg-white border-slate-300 text-transparent'}`}
                        >
                          <CheckSquare className="w-4 h-4" />
                        </button>
                        <span className={`flex-1 text-sm font-semibold ${task.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.text}</span>
                        <button onClick={() => deleteCourseTask(selectedCourse.courseCode, task.id)} className="text-rose-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}

                    {selectedCourseTasks.length === 0 && (
                      <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm font-semibold text-slate-500">
                        Aún no hay tareas. Agrega la primera abajo.
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex gap-3">
                    <input
                      value={newCourseTask}
                      onChange={(e) => setNewCourseTask(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCourseTask(); } }}
                      placeholder="Nueva tarea o pendiente..."
                      className="flex-1 rounded-2xl border-2 border-indigo-200 bg-white px-4 py-3 font-semibold focus:outline-none"
                    />
                    <button onClick={addCourseTask} className="rounded-2xl bg-fuchsia-700 px-4 py-3 font-black text-white border-2 border-fuchsia-900 flex items-center gap-2">
                      <CirclePlus className="w-4 h-4" />
                      Añadir
                    </button>
                  </div>
                </div>

                <div className="mt-5 flex gap-3">
                  <button onClick={() => setSelectedCourseCode(null)} className="flex-1 rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 font-black text-slate-700">
                    Cerrar
                  </button>
                  <button
                    onClick={() => { setDrawerView('horario'); setSelectedCourseCode(null); }}
                    className="flex-1 rounded-2xl border-2 border-indigo-950 bg-indigo-900 px-4 py-3 font-black text-white"
                  >
                    Ver horario
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

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
                  id="modal-editar-actividad"
                  className="bg-white border-2 border-indigo-950 rounded-2xl w-full max-w-sm p-8 space-y-6 shadow-lg"
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

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-2 flex items-center gap-2">
                      <ListTodo className="w-4 h-4" />
                      Checklist del curso
                    </label>
                    <textarea
                      className="w-full min-h-28 bg-slate-50 border-2 border-indigo-900 p-4 rounded-xl focus:outline-none font-mono text-sm"
                      value={checklistText}
                      onChange={(e) => setChecklistText(e.target.value)}
                      placeholder="Escribe una tarea por línea o separa con comas."
                    />
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

                  <div className="flex items-center gap-3 px-4 py-3 bg-rose-50 border-2 border-rose-200 rounded-lg">
                    <input 
                      type="checkbox"
                      id="isCourse"
                      checked={editorData.isCourseMarked}
                      onChange={(e) => setEditorData(prev => ({ ...prev, isCourseMarked: e.target.checked }))}
                      className="w-5 h-5 cursor-pointer accent-rose-700"
                    />
                    <label htmlFor="isCourse" className="text-sm font-bold text-rose-700 cursor-pointer flex-1">
                      🎓 Marcar como curso
                    </label>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Tipo de Actividad</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setEditorData(prev => ({ ...prev, activityType: ActivityType.FIJA_PERMANENTE }))}
                        className={`py-3 px-2 rounded-lg border-2 font-bold text-sm flex flex-col items-center gap-1 transition ${
                          editorData.activityType === ActivityType.FIJA_PERMANENTE
                            ? 'bg-slate-200 border-slate-600'
                            : 'bg-white border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        <span className="text-xl">🔒</span>
                        <span className="text-[9px]">Fija</span>
                      </button>
                      <button
                        onClick={() => setEditorData(prev => ({ ...prev, activityType: ActivityType.FIJA_AJUSTABLE }))}
                        className={`py-3 px-2 rounded-lg border-2 font-bold text-sm flex flex-col items-center gap-1 transition ${
                          editorData.activityType === ActivityType.FIJA_AJUSTABLE
                            ? 'bg-amber-200 border-amber-600'
                            : 'bg-white border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        <span className="text-xl">🔓</span>
                        <span className="text-[9px]">Ajustable</span>
                      </button>
                      <button
                        onClick={() => setEditorData(prev => ({ ...prev, activityType: ActivityType.FLEXIBLE }))}
                        className={`py-3 px-2 rounded-lg border-2 font-bold text-sm flex flex-col items-center gap-1 transition ${
                          editorData.activityType === ActivityType.FLEXIBLE
                            ? 'bg-sky-200 border-sky-600'
                            : 'bg-white border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        <span className="text-xl">✏️</span>
                        <span className="text-[9px]">Flexible</span>
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-2 px-2">
                      {editorData.activityType === ActivityType.FIJA_PERMANENTE && '🔒 No se puede editar hora'}
                      {editorData.activityType === ActivityType.FIJA_AJUSTABLE && '🔓 Permite cambios semanales'}
                      {editorData.activityType === ActivityType.FLEXIBLE && '✏️ Editable sin restricciones'}
                    </p>
                  </div>

                  <div className="mt-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Color personalizado</label>
                    <div className="mt-2 flex items-center gap-3">
                      <input
                        type="color"
                        value={editorData.customColor || DEFAULT_PALETTE[0]}
                        onChange={(e) => setEditorData(prev => ({ ...prev, customColor: e.target.value }))}
                        className="w-12 h-12 p-0 border-2 rounded-lg"
                        aria-label="Seleccionar color"
                      />
                      <input
                        type="text"
                        value={editorData.customColor}
                        onChange={(e) => setEditorData(prev => ({ ...prev, customColor: e.target.value }))}
                        placeholder="#RRGGBB"
                        className="w-full bg-slate-50 border-2 border-indigo-900 p-3 rounded-xl focus:outline-none font-mono text-sm"
                      />
                      <div className="w-10 h-10 rounded-lg border-2" style={{ background: editorData.customColor || 'transparent' }} />
                    </div>

                    <div className="mt-2 flex gap-2">
                      {DEFAULT_PALETTE.map((c) => (
                        <button
                          key={c}
                          onClick={() => setEditorData(prev => ({ ...prev, customColor: c }))}
                          className="w-8 h-8 rounded-lg border-2"
                          style={{ background: c }}
                          aria-label={`usar color ${c}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleSaveActivity}
                  disabled={!editorData.name.trim()}
                  className="w-full py-4 bg-indigo-950 border-2 border-indigo-950 text-white font-hand text-xl rounded-xl shadow-[0_12px_24px_rgba(17,24,39,0.28)] active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none"
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
              initial={{ y: 40, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0, scale: 0.95 }}
              className={`fixed bottom-6 left-4 right-4 max-w-3xl mx-auto text-white p-5 rounded-xl z-[220] flex items-center gap-4 shadow-2xl border-0 ${
                notification.type === 'error' ? 'bg-red-700' :
                notification.type === 'success' ? 'bg-green-700' :
                notification.type === 'info' ? 'bg-blue-700' :
                'bg-rose-700'
              }`}
            >
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shrink-0">
                {notification.type === 'error' ? (
                  <X className="w-6 h-6 text-red-700 font-extrabold" />
                ) : notification.type === 'success' ? (
                  <CheckCircle2 className="w-6 h-6 text-green-700 font-extrabold" />
                ) : (
                  <Bell className="w-6 h-6 text-rose-700 font-extrabold" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-hand text-lg sm:text-xl font-extrabold leading-tight text-white drop-shadow-md">{notification.title}</p>
                <p className="text-base sm:text-lg text-white font-semibold drop-shadow-sm">{notification.message}</p>
              </div>
              <button 
                onClick={() => setNotification(null)} 
                className="text-white hover:opacity-90 transition ml-2"
                aria-label="Cerrar notificación"
              >
                <X className="w-5 h-5 font-extrabold" />
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

        {/* Conflict Modal */}
        <AnimatePresence>
          {conflictModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/70 z-[120] flex items-center justify-center p-4"
              onClick={() => setConflictModal(null)}
            >
              <motion.div
                initial={{ scale: 0.94, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.94, opacity: 0, y: 20 }}
                className="paper-card sketch-border w-full max-w-md p-6 bg-white space-y-5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-red-100 border-2 border-red-600 text-red-700 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-hand text-2xl font-bold text-red-700 leading-tight">{conflictModal.title}</h3>
                    <p className="text-sm text-slate-600 font-semibold mt-1">{conflictModal.message}</p>
                    <p className="text-sm text-indigo-900 font-bold mt-2">{conflictModal.suggestion}</p>
                  </div>
                </div>

                <div className="flex gap-3 flex-col">
                  <button
                    onClick={() => setConflictModal(null)}
                    className="py-3 rounded-xl border-2 border-slate-300 font-bold text-slate-700 bg-white"
                  >
                    Cerrar
                  </button>
                  <button
                    onClick={() => {
                      // Save anyway, then close both conflict and editor modals
                      try {
                        handleSaveActivity();
                      } catch (err) {
                        console.error('Save anyway failed:', err);
                      }
                      setConflictModal(null);
                      setShowEditor(null);
                      setNotification({ title: '✅ Guardado', message: 'La actividad se guardó aunque hay conflicto de horario.', type: 'success' });
                    }}
                    className="py-3 rounded-xl border-2 border-green-600 bg-green-600 font-bold text-white"
                  >
                    Guardar de todas formas
                  </button>
                  <button
                    onClick={() => {
                      setEditorData(prev => ({ ...prev, start: conflictModal.suggestionStart, end: conflictModal.suggestionEnd }));
                      setConflictModal(null);
                      setNotification({ title: 'Ajustado', message: `Se movió al bloque ${conflictModal.suggestionStart} - ${conflictModal.suggestionEnd}.`, type: 'info' });
                    }}
                    className="py-3 rounded-xl border-2 border-indigo-900 bg-indigo-900 font-bold text-white"
                  >
                    Ajustar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal para FIJA_AJUSTABLE (Weekly Exception) */}
        <AnimatePresence>
          {adjustableActivityModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/70 z-[120] flex items-center justify-center p-4"
              onClick={() => setAdjustableActivityModal(null)}
            >
              <motion.div
                initial={{ scale: 0.94, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.94, opacity: 0, y: 20 }}
                className="paper-card sketch-border w-full max-w-md p-6 bg-white space-y-5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-100 border-2 border-amber-600 text-amber-700 flex items-center justify-center shrink-0">
                    <span className="text-xl">🔓</span>
                  </div>
                  <div>
                    <h3 className="font-hand text-2xl font-bold text-amber-700 leading-tight">Cambio Temporal</h3>
                    <p className="text-sm text-slate-600 font-semibold mt-1">¿Cómo deseas cambiar {adjustableActivityModal.activityName}?</p>
                  </div>
                </div>

                <div className="flex gap-3 flex-col">
                  <button
                    onClick={() => {
                      // Only this week - save to user_exceptions table
                      setAdjustableActivityDecision({ 
                        thisWeekOnly: true, 
                        activityId: showEditor?.activityId || '' 
                      });
                      // Trigger save with decision flag
                      setTimeout(() => {
                        const { name, start, end, emoji, isCourseMarked, customColor } = editorData;
                        const isValidHex = (c?: string) => !!c && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c.trim());
                        const chosenColor = isValidHex(customColor) ? customColor!.trim() : DEFAULT_PALETTE[0];
                        
                        setSchedule(prev => {
                          const copy = [...prev];
                          let activities = [...copy[activeDayIndex].activities];
                          activities = activities.map(a => 
                            a.id === showEditor?.activityId
                              ? { 
                                  ...a, 
                                  name: name.trim(), 
                                  startTime: start, 
                                  endTime: end, 
                                  emoji, 
                                  checklist: checklistText.split(/[\n,]/).map(item => item.trim()).filter(Boolean),
                                  courseId: a.courseId || a.id, 
                                  isCourseMarked, 
                                  customColor: isValidHex(customColor) ? customColor : a.customColor,
                                  activityType: editorData.activityType
                                } 
                              : a
                          );
                          activities.sort((a, b) => a.startTime.localeCompare(b.startTime));
                          copy[activeDayIndex] = { ...copy[activeDayIndex], activities };
                          return copy;
                        });
                        
                        const modifiedData = {
                          startTime: start,
                          endTime: end,
                          name: name.trim(),
                          emoji,
                        };
                        saveWeeklyException(showEditor?.activityId || '', modifiedData);
                        
                        setNotification({
                          title: '📅 Solo esta semana',
                          message: `${name.trim()} cambió solo para esta semana.`,
                          type: 'info'
                        });
                        setShowEditor(null);
                        setAdjustableActivityDecision(null);
                        setEditorData({ name: '', start: '12:00', end: '13:00', emoji: '📍', isCourseMarked: false, customColor: '', activityType: ActivityType.FLEXIBLE });
                      }, 0);
                    }}
                    className="py-3 rounded-xl border-2 border-amber-600 bg-amber-600 font-bold text-white hover:bg-amber-700 transition"
                  >
                    Solo esta semana
                  </button>
                  <button
                    onClick={() => {
                      // Permanent change
                      setAdjustableActivityDecision({ 
                        thisWeekOnly: false, 
                        activityId: showEditor?.activityId || '' 
                      });
                      setAdjustableActivityModal(null);
                      // Trigger handleSaveActivity which will now skip the modal check
                      setTimeout(() => handleSaveActivity(), 0);
                    }}
                    className="py-3 rounded-xl border-2 border-indigo-900 bg-indigo-900 font-bold text-white hover:bg-indigo-950 transition"
                  >
                    Cambiar permanentemente
                  </button>
                  <button
                    onClick={() => setAdjustableActivityModal(null)}
                    className="py-3 rounded-xl border-2 border-slate-300 font-bold text-slate-700 bg-white hover:bg-slate-50 transition"
                  >
                    Cancelar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating settings button for mobile (always visible) */}
        <button
          onClick={() => setShowNotificationHoursModal(true)}
          aria-label="Ajustes de notificaciones"
          className="fixed bottom-6 right-6 z-50 bg-yellow-500 hover:bg-yellow-400 text-yellow-900 p-4 rounded-full shadow-xl border-2 border-yellow-700"
        >
          <Settings className="w-6 h-6" />
        </button>

      </div>

      <style>{`
        .glass {
          background: rgba(255, 255, 255, 1);
          border: 1px solid rgba(148, 163, 184, 0.3);
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

const getContrastColor = (color: string) => {
  try {
    const hex = color.replace('#', '').trim();
    const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.6 ? '#000000' : '#ffffff';
  } catch (e) {
    return '#000000';
  }
};

const DraggableActivity: React.FC<DraggableActivityProps> = ({ activity, onEdit, onComplete, colorClass }) => {
  const x = useMotionValue(0);
  const background = useTransform(x, [0, 100], ['rgba(255,255,255,0)', 'rgba(74, 222, 128, 0.2)']);
  const checkOpacity = useTransform(x, [0, 80, 100], [0, 0.5, 1]);
  const scale = useTransform(x, [0, 100], [1, 1.02]);
  const currentTime = new Date();
  
  // Determine if swipe should be allowed
  const canSwipe = canCompleteBySwipe(activity, currentTime);
  const isDimmed = shouldDimActivity(activity, currentTime, false);
  const isFixed = activity.isFixed || activity.esFijo;
  const barColor = getActivityBarColor(activity);
  const customColor = (activity as any).customColor || '';
  const textColor = customColor ? getContrastColor(customColor) : undefined;
  const status = getActivityStatus(activity, currentTime);
  
  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x > 110 && canSwipe) {
      onComplete();
    }
  };

  return (
    <div className={`relative group ${isDimmed ? 'opacity-60' : ''}`}>
      {/* Background feedback for swipe - only visible if swipe allowed */}
      {canSwipe && (
        <motion.div 
          style={{ background, opacity: checkOpacity }}
          className="absolute inset-0 rounded-2xl flex items-center justify-start pl-8"
        >
          <CheckCircle2 className="w-8 h-8 text-green-500" />
        </motion.div>
      )}

      {/* Quick complete button - disabled if swipe not allowed */}
      {canSwipe && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onComplete();
          }}
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full border-2 border-green-500 bg-white text-green-600 flex items-center justify-center shadow-sm active:scale-95 transition hover:bg-green-50"
          aria-label={`Marcar ${activity.name} como completada`}
          title="Quitar del horario"
        >
          <CheckCircle2 className="w-5 h-5" />
        </button>
      )}

      {/* Activity type indicator */}
      <div className="absolute top-3 left-3 z-10">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-bold border-2 ${
          activity.activityType === ActivityType.FIJA_PERMANENTE
            ? 'bg-slate-100 text-slate-700 border-slate-400'
            : activity.activityType === ActivityType.FIJA_AJUSTABLE
            ? 'bg-amber-100 text-amber-700 border-amber-400'
            : 'bg-sky-100 text-sky-700 border-sky-400'
        }`}>
          {activity.activityType === ActivityType.FIJA_PERMANENTE && '🔒'}
          {activity.activityType === ActivityType.FIJA_AJUSTABLE && '🔓'}
          {activity.activityType === ActivityType.FLEXIBLE && '✏️'}
          {!activity.activityType && '📌'}
        </span>
      </div>

      <motion.div
        drag={canSwipe ? "x" : false}
        dragConstraints={{ left: 0, right: 200 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        onClick={onEdit}
        style={{ x: canSwipe ? x : 0, scale, background: customColor || undefined, color: textColor || undefined }}
        className={`relative paper-card sketch-border p-5 ${canSwipe ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} transition-all ${
          customColor ? '' : barColor
        }`}
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
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{activity.emoji}</span>
              <h3 className="font-hand font-bold text-2xl leading-tight text-slate-800">{activity.name}</h3>
            </div>
            <div className={`text-xs ${status.className}`}>
              {status.label}
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
            className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-300 hover:bg-indigo-50 transition-all active:scale-95"
          >
            <span className="text-base">{opt.emoji}</span>
            <span className="text-xs font-bold text-slate-600">{opt.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
