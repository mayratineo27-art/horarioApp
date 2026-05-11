import { motion } from 'motion/react';
import { ChevronRight, ChevronLeft, Plus, Trash2, Check } from 'lucide-react';
import { useState } from 'react';
import { INITIAL_SCHEDULE, DaySchedule, Activity, Category, ActivityType } from '../constants';

interface OnboardingProps {
  userName: string;
  onComplete: (schedule: DaySchedule[]) => void;
}

type OnboardingStep = 'welcome' | 'university' | 'activities' | 'routines' | 'confirm';

interface UniversityData {
  isStudent: boolean;
  universityName: string;
  semester: string;
}

export const Onboarding = ({ userName, onComplete }: OnboardingProps) => {
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [useExample, setUseExample] = useState(false);
  const [universityData, setUniversityData] = useState<UniversityData>({
    isStudent: false,
    universityName: '',
    semester: '',
  });
  const [schedule, setSchedule] = useState<DaySchedule[]>(INITIAL_SCHEDULE);
  const [newActivityName, setNewActivityName] = useState('');
  const [newActivityEmoji, setNewActivityEmoji] = useState('📍');
  const [editingDayIndex, setEditingDayIndex] = useState(0);

  const handleStartWithExample = () => {
    setUseExample(true);
    onComplete(INITIAL_SCHEDULE);
  };

  const handleStartFromScratch = () => {
    setUseExample(false);
    setStep('university');
  };

  const handleUniversityNext = () => {
    setStep('activities');
  };

  const handleAddActivity = (dayIndex: number) => {
    if (!newActivityName.trim()) return;

    const newActivity: Activity = {
      id: `activity-${Date.now()}`,
      name: newActivityName,
      emoji: newActivityEmoji,
      category: Category.ACADEMIC,
      startTime: '10:00',
      endTime: '11:00',
      isFixed: true,
      activityType: ActivityType.FIJA_PERMANENTE,
    };

    const updatedSchedule = [...schedule];
    updatedSchedule[dayIndex].activities.push(newActivity);
    setSchedule(updatedSchedule);
    setNewActivityName('');
    setNewActivityEmoji('📍');
  };

  const handleRemoveActivity = (dayIndex: number, activityId: string) => {
    const updatedSchedule = [...schedule];
    updatedSchedule[dayIndex].activities = updatedSchedule[dayIndex].activities.filter(
      (a) => a.id !== activityId
    );
    setSchedule(updatedSchedule);
  };

  const handleConfirm = () => {
    onComplete(schedule);
  };

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50 p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-2xl"
      >
        {/* STEP 1: Welcome */}
        {step === 'welcome' && (
          <div className="space-y-8 text-center">
            <div>
              <h2 className="text-4xl font-black text-indigo-900 mb-2">¡Bienvenido!</h2>
              <p className="text-lg text-slate-600">👋 {userName}</p>
            </div>

            <p className="text-slate-600 text-lg">
              Configuremos tu horario personalizado. ¿Por dónde prefieres comenzar?
            </p>

            <div className="space-y-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleStartWithExample}
                className="w-full bg-indigo-900 text-white rounded-2xl py-6 px-6 font-bold text-lg flex items-center justify-center gap-3 hover:bg-indigo-950 transition-colors shadow-lg"
              >
                <span>⚡</span>
                Usar horario de ejemplo
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleStartFromScratch}
                className="w-full bg-white text-indigo-900 border-2 border-indigo-900 rounded-2xl py-6 px-6 font-bold text-lg flex items-center justify-center gap-3 hover:bg-indigo-50 transition-colors"
              >
                <span>✏️</span>
                Crear mi horario desde cero
              </motion.button>
            </div>

            <p className="text-xs text-slate-500">
              Siempre puedes cambiar esto después en configuración
            </p>
          </div>
        )}

        {/* STEP 2: University Info */}
        {step === 'university' && (
          <div className="space-y-6 bg-white p-8 rounded-3xl border-2 border-indigo-200 shadow-lg">
            <div>
              <h3 className="text-2xl font-bold text-indigo-900 mb-2">Información Académica</h3>
              <p className="text-slate-600">Cuéntanos sobre tu situación actual</p>
            </div>

            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={universityData.isStudent}
                  onChange={(e) => setUniversityData({ ...universityData, isStudent: e.target.checked })}
                  className="w-5 h-5 rounded border-2 border-indigo-900 accent-indigo-900"
                />
                <span className="font-bold text-slate-700">Soy estudiante universitario</span>
              </label>

              {universityData.isStudent && (
                <>
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2">
                      Universidad
                    </label>
                    <input
                      type="text"
                      value={universityData.universityName}
                      onChange={(e) => setUniversityData({ ...universityData, universityName: e.target.value })}
                      placeholder="Ej: Universidad San Marcos"
                      className="w-full bg-slate-50 border-2 border-indigo-200 p-3 rounded-xl focus:outline-none focus:border-indigo-900 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2">
                      Ciclo / Semestre
                    </label>
                    <input
                      type="text"
                      value={universityData.semester}
                      onChange={(e) => setUniversityData({ ...universityData, semester: e.target.value })}
                      placeholder="Ej: 5to ciclo"
                      className="w-full bg-slate-50 border-2 border-indigo-200 p-3 rounded-xl focus:outline-none focus:border-indigo-900 font-bold"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('welcome')}
                className="flex-1 py-3 rounded-xl border-2 border-slate-300 font-bold text-slate-700 bg-white hover:bg-slate-50 transition"
              >
                Atrás
              </button>
              <button
                onClick={handleUniversityNext}
                className="flex-1 py-3 rounded-xl border-2 border-indigo-900 bg-indigo-900 font-bold text-white hover:bg-indigo-950 transition flex items-center justify-center gap-2"
              >
                Siguiente <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Activities */}
        {step === 'activities' && (
          <div className="space-y-6 bg-white p-8 rounded-3xl border-2 border-indigo-200 shadow-lg">
            <div>
              <h3 className="text-2xl font-bold text-indigo-900 mb-2">Tus Actividades Fijas</h3>
              <p className="text-slate-600">Cursos, trabajo y otras actividades fijas</p>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {schedule.map((day, dayIdx) =>
                day.activities.length > 0 ? (
                  <div key={dayIdx} className="border-2 border-slate-200 rounded-xl p-4">
                    <p className="font-bold text-slate-700 mb-3">{day.day}</p>
                    <div className="space-y-2">
                      {day.activities.map((activity) => (
                        <div
                          key={activity.id}
                          className="flex items-center justify-between bg-slate-50 p-3 rounded-lg"
                        >
                          <span className="text-sm font-bold text-slate-700">
                            {activity.emoji} {activity.name}
                          </span>
                          <button
                            onClick={() => handleRemoveActivity(dayIdx, activity.id)}
                            className="p-1 hover:bg-red-100 rounded text-red-600 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null
              )}
            </div>

            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl">
              <p className="text-sm font-bold text-slate-600">Agregar actividad al {schedule[editingDayIndex].day}</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newActivityName}
                  onChange={(e) => setNewActivityName(e.target.value)}
                  placeholder="Nombre de la actividad"
                  className="flex-1 bg-white border-2 border-indigo-200 p-2 rounded-lg focus:outline-none focus:border-indigo-900 font-bold text-sm"
                />
                <select
                  value={newActivityEmoji}
                  onChange={(e) => setNewActivityEmoji(e.target.value)}
                  className="bg-white border-2 border-indigo-200 p-2 rounded-lg focus:outline-none focus:border-indigo-900"
                >
                  <option value="📘">📘</option>
                  <option value="👨‍💼">👨‍💼</option>
                  <option value="💻">💻</option>
                  <option value="🏋️">🏋️</option>
                  <option value="🎨">🎨</option>
                </select>
                <button
                  onClick={() => handleAddActivity(editingDayIndex)}
                  className="p-2 bg-indigo-900 text-white rounded-lg hover:bg-indigo-950 transition"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('university')}
                className="flex-1 py-3 rounded-xl border-2 border-slate-300 font-bold text-slate-700 bg-white hover:bg-slate-50 transition flex items-center justify-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" /> Atrás
              </button>
              <button
                onClick={() => setStep('routines')}
                className="flex-1 py-3 rounded-xl border-2 border-indigo-900 bg-indigo-900 font-bold text-white hover:bg-indigo-950 transition flex items-center justify-center gap-2"
              >
                Siguiente <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Routines */}
        {step === 'routines' && (
          <div className="space-y-6 bg-white p-8 rounded-3xl border-2 border-indigo-200 shadow-lg">
            <div>
              <h3 className="text-2xl font-bold text-indigo-900 mb-2">Rutinas Diarias</h3>
              <p className="text-slate-600">Desayuno, ejercicio, meditación, etc.</p>
            </div>

            <div className="space-y-2 text-sm text-slate-600">
              <p>Puedes agregar estas rutinas en el siguiente paso o usar el horario de ejemplo.</p>
              <p>Las rutinas son actividades que se repiten cada día pero pueden ajustarse por semana.</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('activities')}
                className="flex-1 py-3 rounded-xl border-2 border-slate-300 font-bold text-slate-700 bg-white hover:bg-slate-50 transition flex items-center justify-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" /> Atrás
              </button>
              <button
                onClick={() => setStep('confirm')}
                className="flex-1 py-3 rounded-xl border-2 border-indigo-900 bg-indigo-900 font-bold text-white hover:bg-indigo-950 transition flex items-center justify-center gap-2"
              >
                Confirmar <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Confirm */}
        {step === 'confirm' && (
          <div className="space-y-6 bg-white p-8 rounded-3xl border-2 border-indigo-200 shadow-lg text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto"
            >
              <Check className="w-8 h-8 text-green-600" />
            </motion.div>

            <div>
              <h3 className="text-2xl font-bold text-indigo-900 mb-2">¡Casi listo!</h3>
              <p className="text-slate-600">Tu horario está configurado y listo para usar</p>
            </div>

            <div className="text-sm text-slate-500 space-y-2">
              <p>✓ Horario personalizado creado</p>
              <p>✓ Notificaciones habilitadas por defecto</p>
              <p>✓ Sincronización en la nube activada</p>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleConfirm}
              className="w-full bg-green-600 text-white rounded-2xl py-4 px-6 font-bold text-lg hover:bg-green-700 transition-colors shadow-lg"
            >
              Empezar a usar Mya Dynamics
            </motion.button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
