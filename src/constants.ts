
export enum Category {
  ACADEMIC = 'Académico',
  WELLNESS = 'Bienestar',
  CREATIVE = 'Creativo',
  TECH_DEV = 'Tech/Dev',
  TRAINING = 'Formación',
  SPECIAL = 'Especial'
}

export enum ActivityType {
  FIJA_PERMANENTE = 'FIJA_PERMANENTE',    // 🔒 University courses, work
  FIJA_AJUSTABLE = 'FIJA_AJUSTABLE',      // 🔓 Meals, exercise, routines
  FLEXIBLE = 'FLEXIBLE'                   // ✏️ Tasks, projects, free time
}

export interface Activity {
  id: string;
  name: string;
  category: Category;
  startTime: string;
  endTime: string;
  isFixed?: boolean;
  esFijo?: boolean;
  isAcademic?: boolean;
  isCourseMarked?: boolean;
  customColor?: string;
  activityType?: ActivityType;  // NEW
  description?: string;
  emoji?: string;
  courseId?: string;
  checklist?: string[];
  isWeekly?: boolean;
  notificationConfig?: {
    enabled?: boolean;
    minutesBefore?: number[];
    sound?: 'default' | 'gentle' | 'urgent' | 'none';
  };
}

export interface DaySchedule {
  day: string;
  activities: Activity[];
}

export const OPTIONS_CATALOG = {
  REPLACEMENTS: [
    { name: 'Proyecto Personal', emoji: '✨' },
    { name: 'Leer Libro', emoji: '🔖' },
    { name: 'Femenino Tech', emoji: '👩‍💻' },
    { name: 'Yoga', emoji: '🧘' },
    { name: 'Boceto de Carteras', emoji: '👜' }
  ]
};

// Helper function to assign activity types
const assignActivityType = (activity: Activity): Activity => {
  const name = activity.name.toLowerCase();
  
  // FIJA_PERMANENTE: Academic courses and work with isAcademic flag
  if (activity.isAcademic) {
    return { ...activity, activityType: ActivityType.FIJA_PERMANENTE };
  }
  
  // FIJA_AJUSTABLE: Fixed meals, exercise, routines, yoga, commute
  if (name.includes('almuerzo') || name.includes('desayuno') || 
      name.includes('cena') || name.includes('ejercicio') || 
      name.includes('yoga') || name.includes('traslado') ||
      name.includes('regreso') || name.includes('alistarse') ||
      name.includes('correr') || name.includes('inglés') ||
      name.includes('diseño moda') || name.includes('yoga especial')) {
    return { ...activity, activityType: ActivityType.FIJA_AJUSTABLE };
  }
  
  // FLEXIBLE: Tasks, projects, study blocks, free time
  // Default to FLEXIBLE for anything else
  return { ...activity, activityType: ActivityType.FLEXIBLE };
};

export const FIXED_MORNING: Activity[] = [
  { id: 'm1', name: 'Correr', category: Category.WELLNESS, startTime: '05:00', endTime: '06:30', isFixed: true, emoji: '🏃' },
  { id: 'm2', name: 'Alistarse', category: Category.WELLNESS, startTime: '06:30', endTime: '06:48', isFixed: true, emoji: '🚿' },
  { id: 'm3', name: 'Desayuno', category: Category.WELLNESS, startTime: '06:48', endTime: '06:58', isFixed: true, emoji: '☕' },
  { id: 'm4', name: 'Traslado', category: Category.WELLNESS, startTime: '06:58', endTime: '07:08', isFixed: true, emoji: '🚗' },
].map(assignActivityType);

export const INITIAL_SCHEDULE: DaySchedule[] = [
  {
    day: 'Lunes',
    activities: [
      ...FIXED_MORNING.map(a => ({ ...a, id: `Lunes-${a.id}` })),
      assignActivityType({ id: 'L-c1', name: 'Redes de Datos (IS-485)', category: Category.ACADEMIC, startTime: '07:00', endTime: '09:00', isFixed: true, isAcademic: true, emoji: '🌐' }),
      assignActivityType({ id: 'L-t1', name: 'Tarea/Estudio', category: Category.ACADEMIC, startTime: '09:00', endTime: '11:00', emoji: '📚' }),
      assignActivityType({ id: 'L-l1', name: 'Lab. Seguridad TI (IS-487)', category: Category.ACADEMIC, startTime: '11:00', endTime: '13:00', isFixed: true, isAcademic: true, emoji: '🛡️' }),
      assignActivityType({ id: 'L-a1', name: 'Almuerzo', category: Category.WELLNESS, startTime: '13:40', endTime: '15:00', isFixed: true, emoji: '🍽️' }),
      assignActivityType({ id: 'L-tasks-p', name: 'Tareas Personales / Proyectos', category: Category.SPECIAL, startTime: '15:00', endTime: '18:20', emoji: '✨' }),
      assignActivityType({ id: 'L-yoga', name: 'Yoga de bienvenida', category: Category.WELLNESS, startTime: '18:20', endTime: '18:35', isFixed: true, emoji: '🧘' }),
      assignActivityType({ id: 'L-tasks-d', name: 'Bloque de Tareas (IA/SQL)', category: Category.ACADEMIC, startTime: '18:35', endTime: '20:00', emoji: '🧠' }),
      assignActivityType({ id: 'L-ex', name: 'Ejercicio: Piernas y Glúteos', category: Category.WELLNESS, startTime: '20:00', endTime: '20:30', isFixed: true, emoji: '💪' }),
      assignActivityType({ id: 'L-dinner', name: 'Cena y Tiempo Personal', category: Category.WELLNESS, startTime: '20:30', endTime: '21:15', isFixed: true, emoji: '🍽️' }),
      assignActivityType({ id: 'L-review', name: 'Repaso y Planificación', category: Category.ACADEMIC, startTime: '21:15', endTime: '22:00', isFixed: true, emoji: '📝' }),
    ]
  },
  {
    day: 'Martes',
    activities: [
      ...FIXED_MORNING.map(a => ({ ...a, id: `Martes-${a.id}` })),
      assignActivityType({ id: 'M-c1', name: 'Investigación Científica (IS-481)', category: Category.ACADEMIC, startTime: '08:00', endTime: '10:00', isFixed: true, isAcademic: true, emoji: '🔬' }),
      assignActivityType({ id: 'M-c2', name: 'Gestión de Riesgos TI (IS-486)', category: Category.ACADEMIC, startTime: '11:00', endTime: '12:00', isFixed: true, isAcademic: true, emoji: '⚠️' }),
      assignActivityType({ id: 'M-a1', name: 'Almuerzo', category: Category.WELLNESS, startTime: '13:40', endTime: '15:00', isFixed: true, emoji: '🍽️' }),
      assignActivityType({ id: 'M-tasks-p', name: 'Tareas Personales / Proyectos', category: Category.SPECIAL, startTime: '15:00', endTime: '18:20', emoji: '✨' }),
      assignActivityType({ id: 'M-yoga', name: 'Yoga de bienvenida', category: Category.WELLNESS, startTime: '18:20', endTime: '18:35', isFixed: true, emoji: '🧘' }),
      assignActivityType({ id: 'M-tasks-d', name: 'Bloque de Tareas (IA/SQL)', category: Category.ACADEMIC, startTime: '18:35', endTime: '20:00', emoji: '🧠' }),
      assignActivityType({ id: 'M-ex', name: 'Ejercicio: Piernas y Glúteos', category: Category.WELLNESS, startTime: '20:00', endTime: '20:30', isFixed: true, emoji: '💪' }),
      assignActivityType({ id: 'M-dinner', name: 'Cena y Tiempo Personal', category: Category.WELLNESS, startTime: '20:30', endTime: '21:15', isFixed: true, emoji: '🍽️' }),
      assignActivityType({ id: 'M-review', name: 'Repaso y Planificación', category: Category.ACADEMIC, startTime: '21:15', endTime: '22:00', isFixed: true, emoji: '📝' }),
    ]
  },
  {
    day: 'Miércoles',
    activities: [
      ...FIXED_MORNING.map(a => ({ ...a, id: `Miercoles-${a.id}` })),
      assignActivityType({ id: 'X-t1', name: 'Tarea/Estudio', category: Category.ACADEMIC, startTime: '08:00', endTime: '11:00', emoji: '📚' }),
      assignActivityType({ id: 'X-c1', name: 'Investigación Científica (IS-481)', category: Category.ACADEMIC, startTime: '11:00', endTime: '12:00', isFixed: true, isAcademic: true, emoji: '🔬' }),
      assignActivityType({ id: 'X-a1', name: 'Almuerzo', category: Category.WELLNESS, startTime: '13:40', endTime: '15:00', isFixed: true, emoji: '🍽️' }),
      assignActivityType({ id: 'X-lab', name: 'Lab. Calidad Software (IS-483)', category: Category.ACADEMIC, startTime: '16:00', endTime: '18:00', isFixed: true, isAcademic: true, emoji: '🔍' }),
      assignActivityType({ id: 'X-home', name: 'Regreso a casa', category: Category.WELLNESS, startTime: '18:00', endTime: '18:20', isFixed: true, emoji: '🏠' }),
      assignActivityType({ id: 'X-yoga', name: 'Yoga de bienvenida', category: Category.WELLNESS, startTime: '18:20', endTime: '18:35', isFixed: true, emoji: '🧘' }),
      assignActivityType({ id: 'X-tasks-d', name: 'Bloque de Tareas (IA/SQL)', category: Category.ACADEMIC, startTime: '18:35', endTime: '20:00', emoji: '🧠' }),
      assignActivityType({ id: 'X-ex', name: 'Ejercicio: Piernas y Glúteos', category: Category.WELLNESS, startTime: '20:00', endTime: '20:30', isFixed: true, emoji: '💪' }),
      assignActivityType({ id: 'X-dinner', name: 'Cena y Tiempo Personal', category: Category.WELLNESS, startTime: '20:30', endTime: '21:15', isFixed: true, emoji: '🍽️' }),
      assignActivityType({ id: 'X-review', name: 'Repaso y Planificación', category: Category.ACADEMIC, startTime: '21:15', endTime: '22:00', isFixed: true, emoji: '📝' }),
    ]
  },
  {
    day: 'Jueves',
    activities: [
      ...FIXED_MORNING.map(a => ({ ...a, id: `Jueves-${a.id}` })),
      assignActivityType({ id: 'J-c1', name: 'Gestión de Datos (IS-488)', category: Category.ACADEMIC, startTime: '07:00', endTime: '09:00', isFixed: true, isAcademic: true, emoji: '📊' }),
      assignActivityType({ id: 'J-c2', name: 'Redes de Datos (IS-485)', category: Category.ACADEMIC, startTime: '09:00', endTime: '10:30', isFixed: true, isAcademic: true, emoji: '🌐' }),
      assignActivityType({ id: 'J-a1', name: 'Almuerzo', category: Category.WELLNESS, startTime: '13:40', endTime: '15:00', isFixed: true, emoji: '🍽️' }),
      assignActivityType({ id: 'J-lab', name: 'Lab. Redes Datos', category: Category.ACADEMIC, startTime: '16:00', endTime: '18:00', isFixed: true, isAcademic: true, emoji: '🌐' }),
      assignActivityType({ id: 'J-home', name: 'Regreso a casa', category: Category.WELLNESS, startTime: '18:00', endTime: '18:20', isFixed: true, emoji: '🏠' }),
      assignActivityType({ id: 'J-yoga', name: 'Yoga de bienvenida', category: Category.WELLNESS, startTime: '18:20', endTime: '18:35', isFixed: true, emoji: '🧘' }),
      assignActivityType({ id: 'J-tasks-d', name: 'Bloque de Tareas (IA/SQL)', category: Category.ACADEMIC, startTime: '18:35', endTime: '20:00', emoji: '🧠' }),
      assignActivityType({ id: 'J-ex', name: 'Ejercicio: Piernas y Glúteos', category: Category.WELLNESS, startTime: '20:00', endTime: '20:30', isFixed: true, emoji: '💪' }),
      assignActivityType({ id: 'J-dinner', name: 'Cena y Tiempo Personal', category: Category.WELLNESS, startTime: '20:30', endTime: '21:15', isFixed: true, emoji: '🍽️' }),
      assignActivityType({ id: 'J-review', name: 'Repaso y Planificación', category: Category.ACADEMIC, startTime: '21:15', endTime: '22:00', isFixed: true, emoji: '📝' }),
    ]
  },
  {
    day: 'Viernes',
    activities: [
      ...FIXED_MORNING.map(a => ({ ...a, id: `Viernes-${a.id}` })),
      assignActivityType({ id: 'V-c1', name: 'Calidad Software (IS-489)', category: Category.ACADEMIC, startTime: '07:00', endTime: '08:00', isFixed: true, isAcademic: true, emoji: '✅' }),
      assignActivityType({ id: 'V-c2', name: 'Gestión de Datos (IS-488)', category: Category.ACADEMIC, startTime: '08:00', endTime: '09:00', isFixed: true, isAcademic: true, emoji: '📊' }),
      assignActivityType({ id: 'V-a1', name: 'Almuerzo', category: Category.WELLNESS, startTime: '13:40', endTime: '15:00', isFixed: true, emoji: '🍽️' }),
      assignActivityType({ id: 'V-lab', name: 'Lab. Gestión Datos', category: Category.ACADEMIC, startTime: '16:00', endTime: '18:00', isFixed: true, isAcademic: true, emoji: '📊' }),
      assignActivityType({ id: 'V-home', name: 'Regreso a casa', category: Category.WELLNESS, startTime: '18:00', endTime: '18:20', isFixed: true, emoji: '🏠' }),
      assignActivityType({ id: 'V-yoga', name: 'Yoga de bienvenida', category: Category.WELLNESS, startTime: '18:20', endTime: '18:35', isFixed: true, emoji: '🧘' }),
      assignActivityType({ id: 'V-tasks-d', name: 'Bloque de Tareas (IA/SQL)', category: Category.ACADEMIC, startTime: '18:35', endTime: '20:00', emoji: '🧠' }),
      assignActivityType({ id: 'V-ex', name: 'Ejercicio: Piernas y Glúteos', category: Category.WELLNESS, startTime: '20:00', endTime: '20:30', isFixed: true, emoji: '💪' }),
      assignActivityType({ id: 'V-dinner', name: 'Cena y Tiempo Personal', category: Category.WELLNESS, startTime: '20:30', endTime: '21:15', isFixed: true, emoji: '🍽️' }),
      assignActivityType({ id: 'V-review', name: 'Repaso y Planificación', category: Category.ACADEMIC, startTime: '21:15', endTime: '22:00', isFixed: true, emoji: '📝' }),
    ]
  },
  {
    day: 'Sábado',
    activities: [
      ...FIXED_MORNING.map(a => ({ ...a, id: `Sabado-${a.id}` })),
      assignActivityType({ id: 'S-i1', name: 'Inglés Intensivo', category: Category.TRAINING, startTime: '07:00', endTime: '13:00', emoji: '🇬🇧' }),
      assignActivityType({ id: 'S-m1', name: 'Diseño Moda', category: Category.CREATIVE, startTime: '14:00', endTime: '17:00', emoji: '👘' }),
      assignActivityType({ id: 'S-tasks-p', name: 'Tareas Personales / Proyectos', category: Category.SPECIAL, startTime: '17:00', endTime: '18:20', emoji: '✨' }),
      assignActivityType({ id: 'S-yoga', name: 'Yoga de bienvenida', category: Category.WELLNESS, startTime: '18:20', endTime: '18:35', isFixed: true, emoji: '🧘' }),
      assignActivityType({ id: 'S-tasks-d', name: 'Bloque de Tareas (IA/SQL)', category: Category.ACADEMIC, startTime: '18:35', endTime: '20:00', emoji: '🧠' }),
      assignActivityType({ id: 'S-ex', name: 'Ejercicio: Piernas y Glúteos', category: Category.WELLNESS, startTime: '20:00', endTime: '20:30', isFixed: true, emoji: '💪' }),
      assignActivityType({ id: 'S-dinner', name: 'Cena y Tiempo Personal', category: Category.WELLNESS, startTime: '20:30', endTime: '21:15', isFixed: true, emoji: '🍽️' }),
      assignActivityType({ id: 'S-review', name: 'Repaso y Planificación', category: Category.ACADEMIC, startTime: '21:15', endTime: '22:00', isFixed: true, emoji: '📝' }),
    ]
  },
  {
    day: 'Domingo',
    activities: [
      ...FIXED_MORNING.map(a => ({ ...a, id: `Domingo-${a.id}` })),
      assignActivityType({ id: 'D-l1', name: 'Descanso / Repaso', category: Category.ACADEMIC, startTime: '08:00', endTime: '10:00', emoji: '🛌' }),
      assignActivityType({ id: 'D-y1', name: 'Yoga Especial', category: Category.WELLNESS, startTime: '10:00', endTime: '11:30', emoji: '🧘' }),
      assignActivityType({ id: 'D-tasks-p', name: 'Tareas Personales / Proyectos', category: Category.SPECIAL, startTime: '12:00', endTime: '18:20', emoji: '✨' }),
      assignActivityType({ id: 'D-yoga', name: 'Yoga de bienvenida', category: Category.WELLNESS, startTime: '18:20', endTime: '18:35', isFixed: true, emoji: '🧘' }),
      assignActivityType({ id: 'D-tasks-d', name: 'Bloque de Tareas (IA/SQL)', category: Category.ACADEMIC, startTime: '18:35', endTime: '20:00', emoji: '🧠' }),
      assignActivityType({ id: 'D-ex', name: 'Ejercicio: Piernas y Glúteos', category: Category.WELLNESS, startTime: '20:00', endTime: '20:30', isFixed: true, emoji: '💪' }),
      assignActivityType({ id: 'D-dinner', name: 'Cena y Tiempo Personal', category: Category.WELLNESS, startTime: '20:30', endTime: '21:15', isFixed: true, emoji: '🍽️' }),
      assignActivityType({ id: 'D-review', name: 'Repaso y Planificación', category: Category.ACADEMIC, startTime: '21:15', endTime: '22:00', isFixed: true, emoji: '📝' }),
    ]
  },
];

