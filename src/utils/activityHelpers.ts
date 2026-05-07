/**
 * Activity visibility and styling utilities for Mya Dynamics
 * Implements smart expiry for fixed activities and visual distinction
 */

import { Activity, Category } from '../constants';

/**
 * Determines if a fixed activity should be hidden based on current time
 * Fixed activities (meals, routines) auto-hide after their endTime
 * Non-fixed activities (tasks, projects) persist until manually completed
 * Only applies to the schedule for the current real-world day.
 */
export const shouldHideFixedActivity = (activity: Activity, currentTime: Date, isCurrentDay = true): boolean => {
  if (!isCurrentDay) return false;

  // Only hide if it's marked as fixed
  const isFixed = activity.isFixed || activity.esFijo;
  if (!isFixed) return false;

  // Courses and labs should remain visible in the schedule even after they end.
  // Only hide routine-like fixed activities (meals, exercise, commute, etc.).
  const isAcademic =
    activity.category === Category.ACADEMIC ||
    activity.isAcademic ||
    activity.name.includes('(IS-') ||
    activity.name.includes('Lab');

  if (isAcademic) return false;

  // Parse activity end time
  const [endH, endM] = activity.endTime.split(':').map(Number);
  const endMinutes = endH * 60 + endM;
  const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

  // Hide if current time is past the end time
  return nowMinutes > endMinutes;
};

/**
 * Determines if an activity can be swiped to complete
 * - Non-fixed tasks: always swipeable
 * - Fixed activities: only if in-progress or future
 */
export const canCompleteBySwipe = (activity: Activity, currentTime: Date): boolean => {
  const isFixed = activity.isFixed || activity.esFijo;
  if (!isFixed) return true; // Non-fixed tasks can always be swiped

  // For fixed activities, only allow swipe if in progress or future
  const [startH, startM] = activity.startTime.split(':').map(Number);
  const [endH, endM] = activity.endTime.split(':').map(Number);
  const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  // Allow swipe if activity is in progress or hasn't started yet
  return nowMinutes < endMinutes; // Either in progress or future
};

/**
 * Maps activity category to visual styling (border color)
 * Different colors for different types:
 * - Courses/Academic: Steel Blue (rigidez académica)
 * - Fixed Routines: Soft Green or Neutral Gray (flujo automático)
 * - Tasks/Personal: Bright Orange or Lavender (atención requerida)
 */
export const getActivityBarColor = (activity: Activity): string => {
  const isFixed = activity.isFixed || activity.esFijo;
  const isCourse = activity.isCourseMarked || activity.isAcademic || activity.name.includes('(IS-') || activity.name.includes('Lab');
  const isAcademic =
    activity.category === Category.ACADEMIC ||
    activity.isAcademic ||
    activity.name.includes('(IS-') ||
    activity.name.includes('Lab');

  // Course activities (marked or auto-detected) - Steel Blue
  if (isCourse) {
    return 'bg-gradient-to-br from-slate-100 via-slate-200 to-slate-100 border-l-4 border-slate-700 text-slate-900';
  }

  // Fixed routine activities (meals, exercise, yoga) - Soft Green
  if (isFixed) {
    return 'bg-emerald-50 border-l-4 border-emerald-500 text-emerald-900';
  }

  // Non-fixed tasks and personal projects (require manual action) - Bright Orange
  return 'bg-orange-50 border-l-4 border-orange-500 text-orange-900';
};

/**
 * Gets the visual indicator (badge color) for an activity
 * Used for category pills and quick visual identification
 */
export const getCategoryBadgeColor = (category: Category): string => {
  switch (category) {
    case Category.ACADEMIC:
      return 'bg-blue-100 border-blue-300 text-blue-700';
    case Category.WELLNESS:
      return 'bg-green-100 border-green-300 text-green-700';
    case Category.CREATIVE:
      return 'bg-purple-100 border-purple-300 text-purple-700';
    case Category.TECH_DEV:
      return 'bg-cyan-100 border-cyan-300 text-cyan-700';
    case Category.TRAINING:
      return 'bg-orange-100 border-orange-300 text-orange-700';
    case Category.SPECIAL:
      return 'bg-pink-100 border-pink-300 text-pink-700';
    default:
      return 'bg-gray-100 border-gray-300 text-gray-700';
  }
};

/**
 * Determines the subtitle text for an activity
 * Shows if it's fixed, in-progress, upcoming, or past
 */
export const getActivityStatus = (
  activity: Activity,
  currentTime: Date
): { label: string; className: string } => {
  const [startH, startM] = activity.startTime.split(':').map(Number);
  const [endH, endM] = activity.endTime.split(':').map(Number);
  const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  const isFixed = activity.isFixed || activity.esFijo;

  if (nowMinutes >= startMinutes && nowMinutes < endMinutes) {
    return { label: '🔴 En curso', className: 'text-red-600 font-semibold' };
  }

  if (nowMinutes < startMinutes) {
    const minsUntil = startMinutes - nowMinutes;
    const hrsUntil = Math.floor(minsUntil / 60);
    const reminder = minsUntil % 60;
    const timeStr =
      hrsUntil > 0
        ? `${hrsUntil}h ${reminder > 0 ? reminder + 'm' : ''}`
        : `${reminder}m`;
    return { label: `⏳ En ${timeStr}`, className: 'text-amber-600' };
  }

  if (isFixed) {
    return { label: '✅ Completada', className: 'text-green-600' };
  }

  return { label: '⏸ Pendiente', className: 'text-orange-600 font-semibold' };
};

/**
 * Determines if an activity should be dimmed/grayed out
 * Shows visual feedback for completed or passed fixed activities
 */
export const shouldDimActivity = (
  activity: Activity,
  currentTime: Date,
  isCompleted: boolean
): boolean => {
  if (isCompleted) return true;

  const isFixed = activity.isFixed || activity.esFijo;
  if (!isFixed) return false;

  const [endH, endM] = activity.endTime.split(':').map(Number);
  const endMinutes = endH * 60 + endM;
  const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

  return nowMinutes > endMinutes;
};
