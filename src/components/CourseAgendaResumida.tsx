"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { 
  Calendar, ChevronLeft, ChevronRight, AlertTriangle, 
  Clock, MapPin, User, Filter, AlertCircle, 
  CheckCircle2, Flag, ArrowRight, ShieldCheck, ChevronDown
} from "lucide-react";
import { getEcuadorHolidays, isEcuadorHoliday, EcuadorHoliday } from "@/lib/ecuador-holidays";

export interface ScheduledClass {
  id: string;
  moduleId: string;
  moduleName: string;
  moduleNumber: number;
  courseId: string;
  courseName: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  teacherName?: string | null;
  classroom?: string | null;
  courseColor: string;
}

export interface CourseOption {
  id: string;
  name: string;
  status: string;
  color: string;
}

interface Props {
  classes: ScheduledClass[];
  courses: CourseOption[];
}

const WEEK_DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function CourseAgendaResumida({ classes, courses }: Props) {
  const todayStr = useMemo(() => {
    return new Date().toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" });
  }, []);

  const [currentYear, setCurrentYear] = useState(() => parseInt(todayStr.slice(0, 4), 10));
  const [currentMonth, setCurrentMonth] = useState(() => parseInt(todayStr.slice(5, 7), 10) - 1);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"weekends" | "calendar">("weekends");
  const [onlyBusyFilter, setOnlyBusyFilter] = useState<boolean>(true);
  const [showHolidaysList, setShowHolidaysList] = useState<boolean>(false);

  // Clases filtradas por curso
  const filteredClasses = useMemo(() => {
    if (selectedCourseId === "all") return classes;
    return classes.filter((c) => c.courseId === selectedCourseId);
  }, [classes, selectedCourseId]);

  // Feriados del año y mes
  const yearHolidays = useMemo(() => getEcuadorHolidays(currentYear), [currentYear]);

  const monthHolidays = useMemo(() => {
    const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
    return yearHolidays.filter((h) => h.date.startsWith(monthPrefix));
  }, [yearHolidays, currentYear, currentMonth]);

  // Mapa de clases por fecha
  const classesByDate = useMemo(() => {
    const map = new Map<string, ScheduledClass[]>();
    for (const c of filteredClasses) {
      const list = map.get(c.date) || [];
      list.push(c);
      map.set(c.date, list);
    }
    return map;
  }, [filteredClasses]);

  // Análisis de conflictos y cruces
  const conflictsByDate = useMemo(() => {
    const map = new Map<string, {
      hasConflict: boolean;
      isHoliday: boolean;
      holidayName?: string;
      messages: string[];
    }>();

    for (const [dateStr, list] of classesByDate.entries()) {
      const holiday = isEcuadorHoliday(dateStr);
      const messages: string[] = [];

      if (holiday) {
        messages.push(`Coincide con Feriado Nacional: ${holiday.name}`);
      }

      if (list.length > 1) {
        for (let i = 0; i < list.length; i++) {
          for (let j = i + 1; j < list.length; j++) {
            const a = list[i];
            const b = list[j];
            const aStart = a.startTime || "00:00";
            const aEnd = a.endTime || "23:59";
            const bStart = b.startTime || "00:00";
            const bEnd = b.endTime || "23:59";

            if (aStart < bEnd && aEnd > bStart) {
              if (a.courseId !== b.courseId) {
                messages.push(`Cruce de cursos: "${a.courseName}" y "${b.courseName}" (${aStart} - ${aEnd})`);
              } else {
                messages.push(`Doble sesión simultánea en "${a.courseName}" (${aStart} - ${aEnd})`);
              }
              if (a.classroom && b.classroom && a.classroom.trim().toLowerCase() === b.classroom.trim().toLowerCase()) {
                messages.push(`Misma aula: "${a.classroom}".`);
              }
            }
          }
        }
      }

      if (messages.length > 0) {
        map.set(dateStr, {
          hasConflict: true,
          isHoliday: !!holiday,
          holidayName: holiday?.name,
          messages,
        });
      }
    }

    return map;
  }, [classesByDate]);

  // Bloques de fin de semana (Viernes, Sábado y Domingo)
  const weekendBlocks = useMemo(() => {
    const blocks: {
      id: string;
      label: string;
      dates: {
        dateStr: string;
        dayName: string;
        dayShort: string;
        dayNumber: number;
        isToday: boolean;
        holiday: EcuadorHoliday | null;
        classes: ScheduledClass[];
        conflict: ReturnType<typeof conflictsByDate.get>;
      }[];
      hasAnyClass: boolean;
      hasAnyHoliday: boolean;
      hasAnyConflict: boolean;
    }[] = [];

    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);

    const cur = new Date(firstDay);
    while (cur <= lastDay) {
      const dayOfWeek = cur.getDay(); // 0=Dom, 1=Lun, ..., 5=Vie, 6=Sáb
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, "0");
      const d = String(cur.getDate()).padStart(2, "0");
      const dateStr = `${y}-${m}-${d}`;

      const holiday = isEcuadorHoliday(dateStr);
      const dayClasses = classesByDate.get(dateStr) || [];
      const conflict = conflictsByDate.get(dateStr);

      const isWeekendDay = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0;
      const hasContent = dayClasses.length > 0 || !!holiday;

      if (isWeekendDay || hasContent) {
        const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
        const dayShorts = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
        const dayItem = {
          dateStr,
          dayName: dayNames[dayOfWeek],
          dayShort: dayShorts[dayOfWeek],
          dayNumber: cur.getDate(),
          isToday: dateStr === todayStr,
          holiday,
          classes: dayClasses,
          conflict,
        };

        if (isWeekendDay) {
          const satDate = new Date(cur);
          if (dayOfWeek === 5) satDate.setDate(satDate.getDate() + 1);
          if (dayOfWeek === 0) satDate.setDate(satDate.getDate() - 1);
          const blockId = `weekend_${satDate.getFullYear()}_${satDate.getMonth()}_${satDate.getDate()}`;

          let existingBlock = blocks.find((b) => b.id === blockId);
          if (!existingBlock) {
            existingBlock = {
              id: blockId,
              label: `Fin de semana del ${satDate.getDate()} de ${new Date(currentYear, currentMonth, 1).toLocaleDateString("es-EC", { month: "long" })}`,
              dates: [],
              hasAnyClass: false,
              hasAnyHoliday: false,
              hasAnyConflict: false,
            };
            blocks.push(existingBlock);
          }

          existingBlock.dates.push(dayItem);
          if (dayClasses.length > 0) existingBlock.hasAnyClass = true;
          if (holiday) existingBlock.hasAnyHoliday = true;
          if (conflict?.hasConflict) existingBlock.hasAnyConflict = true;
        } else if (hasContent) {
          blocks.push({
            id: `single_${dateStr}`,
            label: `${dayNames[dayOfWeek]} ${cur.getDate()} de ${new Date(currentYear, currentMonth, 1).toLocaleDateString("es-EC", { month: "long" })}`,
            dates: [dayItem],
            hasAnyClass: dayClasses.length > 0,
            hasAnyHoliday: !!holiday,
            hasAnyConflict: conflict?.hasConflict || false,
          });
        }
      }

      cur.setDate(cur.getDate() + 1);
    }

    return blocks;
  }, [currentYear, currentMonth, todayStr, classesByDate, conflictsByDate]);

  // Días del grid mensual
  const calendarGridDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const dayOfWeek = firstDay.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const gridStart = new Date(firstDay);
    gridStart.setDate(gridStart.getDate() - diffToMonday);

    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const lastDayOfWeek = lastDay.getDay();
    const diffToSunday = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek;

    const gridEnd = new Date(lastDay);
    gridEnd.setDate(gridEnd.getDate() + diffToSunday);

    const days: {
      dateStr: string;
      dayNumber: number;
      inCurrentMonth: boolean;
      isToday: boolean;
      holiday: EcuadorHoliday | null;
      classes: ScheduledClass[];
      hasConflict: boolean;
    }[] = [];

    const cur = new Date(gridStart);
    while (cur <= gridEnd) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, "0");
      const d = String(cur.getDate()).padStart(2, "0");
      const str = `${y}-${m}-${d}`;

      const holiday = isEcuadorHoliday(str);
      const dayClasses = classesByDate.get(str) || [];
      const conflict = conflictsByDate.get(str);

      days.push({
        dateStr: str,
        dayNumber: cur.getDate(),
        inCurrentMonth: cur.getMonth() === currentMonth,
        isToday: str === todayStr,
        holiday,
        classes: dayClasses,
        hasConflict: conflict?.hasConflict || false,
      });

      cur.setDate(cur.getDate() + 1);
    }

    return days;
  }, [currentYear, currentMonth, todayStr, classesByDate, conflictsByDate]);

  const monthName = useMemo(() => {
    const d = new Date(currentYear, currentMonth, 1);
    const name = d.toLocaleDateString("es-EC", { month: "long" });
    return name.charAt(0).toUpperCase() + name.slice(1);
  }, [currentYear, currentMonth]);

  const monthClassesCount = useMemo(() => {
    const prefix = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
    return filteredClasses.filter((c) => c.date.startsWith(prefix)).length;
  }, [filteredClasses, currentYear, currentMonth]);

  const monthConflictsCount = useMemo(() => {
    let count = 0;
    const prefix = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
    for (const [d, conf] of conflictsByDate.entries()) {
      if (d.startsWith(prefix) && conf.hasConflict) count++;
    }
    return count;
  }, [conflictsByDate, currentYear, currentMonth]);

  const visibleBlocks = useMemo(() => {
    if (!onlyBusyFilter) return weekendBlocks;
    return weekendBlocks.filter((b) => b.hasAnyClass || b.hasAnyHoliday);
  }, [weekendBlocks, onlyBusyFilter]);

  function handlePrevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }

  function handleNextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }

  function handleGoToday() {
    const [y, m] = todayStr.split("-").map(Number);
    setCurrentYear(y);
    setCurrentMonth(m - 1);
  }

  return (
    <div className="space-y-3.5">
      {/* 1. BARRA MINIMALISTA DE CONTROL EN UNA SOLA LÍNEA */}
      <div className="bg-white border border-lilac-150 rounded-2xl px-4 py-3 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Selector de Mes Compacto */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-lilac-50 border border-lilac-200 rounded-xl p-0.5">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 hover:bg-white text-ink-700 rounded-lg transition cursor-pointer"
              title="Mes anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={handleGoToday}
              className="px-2 py-0.5 text-[11px] font-bold text-lilac-800 hover:bg-white rounded-lg transition cursor-pointer"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 hover:bg-white text-ink-700 rounded-lg transition cursor-pointer"
              title="Mes siguiente"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <span className="font-black text-sm text-ink-950">
            {monthName} {currentYear}
          </span>

          <span className="text-[11px] font-medium text-ink-400 border-l border-lilac-100 pl-2">
            {monthClassesCount} {monthClassesCount === 1 ? "sesión" : "sesiones"}
          </span>
        </div>

        {/* Filtros Compactos */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro por Curso */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-xl">
            <Filter size={11} className="text-lilac-600" />
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="bg-transparent text-ink-800 font-bold outline-none cursor-pointer text-xs"
            >
              <option value="all">Todos los cursos ({courses.length})</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Alternador de Vista */}
          <div className="flex items-center bg-gray-100 p-0.5 rounded-xl border border-gray-200">
            <button
              type="button"
              onClick={() => setViewMode("weekends")}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer text-xs ${
                viewMode === "weekends" ? "bg-white text-ink-900 shadow-2xs" : "text-ink-600 hover:text-ink-900"
              }`}
            >
              Fines de Semana
            </button>
            <button
              type="button"
              onClick={() => setViewMode("calendar")}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer text-xs ${
                viewMode === "calendar" ? "bg-white text-ink-900 shadow-2xs" : "text-ink-600 hover:text-ink-900"
              }`}
            >
              Mes Completo
            </button>
          </div>

          {/* Toggle Solo Fechas Activas */}
          {viewMode === "weekends" && (
            <button
              type="button"
              onClick={() => setOnlyBusyFilter((v) => !v)}
              className={`px-2.5 py-1 rounded-xl font-bold transition cursor-pointer border text-xs ${
                onlyBusyFilter
                  ? "bg-lilac-50 text-lilac-800 border-lilac-200"
                  : "bg-white text-ink-500 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {onlyBusyFilter ? "Ocultar días libres" : "Ver todos"}
            </button>
          )}
        </div>
      </div>

      {/* 2. ALERTA COMPACTA EN UNA LÍNEA (Solo visible si hay cruces o feriados) */}
      {monthConflictsCount > 0 ? (
        <div className="px-3.5 py-2 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-900 text-xs font-medium">
          <AlertTriangle size={14} className="text-red-600 shrink-0" />
          <span>
            <b>¡Cruce o coincidencia detectada!</b> Se identificaron {monthConflictsCount} fecha(s) con cruces de horario o clases en días feriados en {monthName}.
          </span>
        </div>
      ) : (
        <div className="px-3 py-1.5 bg-green-50/60 border border-green-200/80 rounded-xl flex items-center justify-between text-green-900 text-[11px] font-medium">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-green-600 shrink-0" />
            <span>Sin cruces de horarios entre cursos en este mes.</span>
          </div>
          {monthHolidays.length > 0 && (
            <span className="text-amber-800 font-bold flex items-center gap-1">
              <Flag size={11} className="text-amber-700" />
              {monthHolidays.length} feriado(s) en {monthName}: {monthHolidays.map((h) => h.name).join(", ")}
            </span>
          )}
        </div>
      )}

      {/* 3. VISTA RESUMIDA ULTRA-COMPACTA POR FINES DE SEMANA */}
      {viewMode === "weekends" && (
        <div className="space-y-3">
          {visibleBlocks.length === 0 ? (
            <div className="bg-white border border-dashed border-lilac-200 rounded-2xl p-8 text-center text-xs text-ink-500">
              No hay sesiones ni feriados registrados en los fines de semana de {monthName} {currentYear}.
            </div>
          ) : (
            visibleBlocks.map((block) => (
              <div
                key={block.id}
                className={`bg-white border rounded-2xl overflow-hidden shadow-2xs transition-all ${
                  block.hasAnyConflict
                    ? "border-red-300 ring-1 ring-red-100"
                    : block.hasAnyClass
                    ? "border-lilac-200"
                    : "border-gray-200 bg-gray-50/40"
                }`}
              >
                {/* Cabecera del fin de semana compacta */}
                <div className="px-4 py-2 bg-gray-50/70 border-b border-gray-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-lilac-600" />
                    <span className="font-extrabold text-ink-950">{block.label}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {block.hasAnyHoliday && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1">
                        <Flag size={10} className="text-amber-700" /> Feriado Nacional
                      </span>
                    )}
                    {block.hasAnyConflict && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-100 text-red-900 border border-red-200 flex items-center gap-1">
                        <AlertTriangle size={10} className="text-red-600" /> Posible cruce
                      </span>
                    )}
                  </div>
                </div>

                {/* Filas de Días y Clases */}
                <div className="divide-y divide-gray-100">
                  {block.dates.map((day) => {
                    const hasClasses = day.classes.length > 0;
                    const hasHoliday = !!day.holiday;

                    return (
                      <div
                        key={day.dateStr}
                        className={`px-4 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs transition-colors ${
                          day.isToday ? "bg-lilac-50/40" : ""
                        }`}
                      >
                        {/* Fecha Badge */}
                        <div className="flex items-center gap-2.5 shrink-0 w-36">
                          <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center font-bold text-center border shrink-0 ${
                            day.isToday
                              ? "bg-lilac-600 text-white border-lilac-600"
                              : hasHoliday
                              ? "bg-amber-100 text-amber-950 border-amber-300"
                              : hasClasses
                              ? "bg-lilac-50 text-lilac-900 border-lilac-200"
                              : "bg-gray-50 text-ink-400 border-gray-200"
                          }`}>
                            <span className="text-[8px] uppercase tracking-wider leading-none">
                              {day.dayShort}
                            </span>
                            <span className="text-sm font-black leading-tight mt-0.5">
                              {day.dayNumber}
                            </span>
                          </div>

                          <div className="min-w-0">
                            <span className="font-bold text-ink-900 block truncate leading-tight">
                              {day.dayName}
                            </span>
                            {hasHoliday && (
                              <span className="text-[10px] font-bold text-amber-800 block truncate" title={day.holiday?.description}>
                                🇪🇨 {day.holiday?.name}
                              </span>
                            )}
                            {!hasHoliday && !hasClasses && (
                              <span className="text-[10px] text-ink-400">Libre</span>
                            )}
                          </div>
                        </div>

                        {/* Clases o Estado en este Día */}
                        <div className="flex-1 min-w-0">
                          {day.conflict?.hasConflict && (
                            <div className="mb-2 p-1.5 rounded-lg bg-red-50 border border-red-200 text-red-900 text-[11px] font-medium flex items-center gap-1.5">
                              <AlertTriangle size={12} className="text-red-600 shrink-0" />
                              <span>{day.conflict.messages.join(" · ")}</span>
                            </div>
                          )}

                          {day.classes.length === 0 ? (
                            <span className="text-ink-400 italic text-[11px]">
                              {hasHoliday ? "Día festivo - Sin clases asignadas" : "Sin sesiones programadas"}
                            </span>
                          ) : (
                            <div className="space-y-1.5">
                              {day.classes.map((cls) => (
                                <div
                                  key={cls.id}
                                  className={`p-2 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs ${cls.courseColor}`}
                                >
                                  {/* Info Principal */}
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                                    <span className="font-black text-ink-950 truncate max-w-[200px]" title={cls.courseName}>
                                      {cls.courseName}
                                    </span>
                                    <span className="text-ink-400">·</span>
                                    <span className="font-medium opacity-90 truncate max-w-[220px]" title={cls.title}>
                                      {cls.moduleName}
                                    </span>
                                  </div>

                                  {/* Horario y Detalles */}
                                  <div className="flex items-center gap-3 shrink-0 text-[11px] opacity-90">
                                    <span className="font-mono font-bold flex items-center gap-1">
                                      <Clock size={11} /> {cls.startTime} - {cls.endTime}
                                    </span>
                                    {cls.teacherName && (
                                      <span className="hidden sm:inline-flex items-center gap-1">
                                        <User size={11} /> {cls.teacherName}
                                      </span>
                                    )}
                                    {cls.classroom && (
                                      <span className="hidden md:inline-flex items-center gap-1">
                                        <MapPin size={11} /> {cls.classroom}
                                      </span>
                                    )}
                                    <Link
                                      href={`/erp/cursos/${cls.courseId}`}
                                      className="p-1 hover:bg-black/10 rounded-lg text-ink-800 transition"
                                      title="Ver curso para modificar o gestionar"
                                    >
                                      <ArrowRight size={13} />
                                    </Link>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 4. VISTA ALTERNATIVA: CALENDARIO MENSUAL COMPACTO */}
      {viewMode === "calendar" && (
        <div className="bg-white border border-lilac-150 rounded-2xl p-4 shadow-2xs space-y-2">
          <div className="grid grid-cols-7 gap-1 text-center font-bold text-[11px] text-ink-400 uppercase tracking-wider pb-1.5 border-b border-lilac-100">
            {WEEK_DAYS.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarGridDays.map((cell) => {
              const hasClasses = cell.classes.length > 0;
              const hasHoliday = !!cell.holiday;

              return (
                <div
                  key={cell.dateStr}
                  className={`min-h-[64px] sm:min-h-[72px] rounded-xl p-1.5 border flex flex-col justify-between transition-all ${
                    cell.isToday
                      ? "border-lilac-500 bg-lilac-50/40 ring-1 ring-lilac-300"
                      : !cell.inCurrentMonth
                      ? "border-gray-100 bg-gray-50/40 opacity-30"
                      : cell.hasConflict
                      ? "border-red-300 bg-red-50/30"
                      : hasHoliday
                      ? "border-amber-200 bg-amber-50/30"
                      : hasClasses
                      ? "border-lilac-200 bg-white"
                      : "border-gray-100 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center ${
                        cell.isToday ? "bg-lilac-600 text-white" : cell.inCurrentMonth ? "text-ink-900" : "text-ink-400"
                      }`}
                    >
                      {cell.dayNumber}
                    </span>
                    {hasHoliday && (
                      <span className="text-[8px] font-black text-amber-900 bg-amber-100 px-1 rounded" title={cell.holiday?.name}>
                        EC
                      </span>
                    )}
                  </div>

                  <div className="space-y-0.5">
                    {cell.classes.slice(0, 2).map((cls) => (
                      <div
                        key={cls.id}
                        className={`text-[8px] font-bold px-1 py-0.2 rounded truncate border ${cls.courseColor}`}
                        title={`${cls.courseName} - ${cls.startTime} a ${cls.endTime}`}
                      >
                        {cls.courseName}
                      </div>
                    ))}
                    {cell.classes.length > 2 && (
                      <div className="text-[8px] font-bold text-lilac-700 text-center">
                        +{cell.classes.length - 2}
                      </div>
                    )}
                  </div>

                  {cell.hasConflict && (
                    <div className="text-[8px] font-black text-red-600 flex items-center gap-0.5">
                      <AlertTriangle size={8} /> Cruce
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. SECCIÓN PLEGABLE DE FERIADOS NACIONALES DEL AÑO (AHORRO MÁXIMO DE ESPACIO) */}
      <div className="border border-lilac-150 rounded-2xl bg-white overflow-hidden text-xs">
        <button
          type="button"
          onClick={() => setShowHolidaysList((v) => !v)}
          className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-lilac-50/40 transition cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Flag size={13} className="text-amber-700" />
            <span className="font-bold text-ink-800">
              Feriados Nacionales de Ecuador ({currentYear})
            </span>
            <span className="text-[10px] text-ink-400">· 11 feriados oficiales por ley</span>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-semibold text-lilac-700">
            <span>{showHolidaysList ? "Ocultar" : "Consultar feriados"}</span>
            <ChevronDown size={14} className={`transition-transform duration-200 ${showHolidaysList ? "rotate-180" : ""}`} />
          </div>
        </button>

        {showHolidaysList && (
          <div className="p-3 bg-gray-50/50 border-t border-lilac-100 grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {yearHolidays.map((h) => {
              const [y, m, d] = h.date.split("-").map(Number);
              const dateObj = new Date(y, m - 1, d);
              const dayOfWeek = dateObj.toLocaleDateString("es-EC", { weekday: "short" });

              return (
                <div
                  key={h.date}
                  className="p-2 rounded-xl border border-gray-200 bg-white flex items-center justify-between gap-2 shadow-2xs"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-ink-900 block truncate text-[11px]">{h.name}</span>
                    <span className="text-[10px] text-ink-500 capitalize">
                      {dayOfWeek}, {d} {dateObj.toLocaleDateString("es-EC", { month: "short" })}
                    </span>
                  </div>
                  <span className="text-[9px] font-black text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 shrink-0">
                    Ley
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
