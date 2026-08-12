import { GraduationCap, BookOpen, FileText, Clock } from "lucide-react";

export default function CursosLoading() {
  return (
    <div className="max-w-6xl mx-auto pb-10 space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-lilac-100 flex items-center justify-center text-lilac-400">
            <GraduationCap size={24} />
          </div>
          <div className="space-y-2">
            <div className="h-6 w-64 bg-slate-200 rounded-lg" />
            <div className="h-3 w-96 bg-slate-100 rounded-md" />
          </div>
        </div>
      </div>

      {/* Stats Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-8">
        {[
          { label: "Total Operativos", icon: <BookOpen size={18} /> },
          { label: "En Borrador", icon: <FileText size={18} /> },
          { label: "Activos", icon: <GraduationCap size={18} /> },
          { label: "En Ejecución", icon: <Clock size={18} /> },
        ].map((stat, idx) => (
          <div key={idx} className="card p-3.5 bg-white border border-slate-100 shadow-2xs flex items-center gap-3 rounded-2xl">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-300 shrink-0">
              {stat.icon}
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="h-3 w-20 bg-slate-100 rounded-md" />
              <div className="h-5 w-10 bg-slate-200 rounded-md" />
            </div>
          </div>
        ))}
      </div>

      {/* Grid Skeleton Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="card p-5 bg-white border border-slate-100 rounded-3xl space-y-4 shadow-2xs">
            <div className="h-44 w-full bg-slate-100 rounded-2xl" />
            <div className="space-y-2">
              <div className="h-5 w-3/4 bg-slate-200 rounded-md" />
              <div className="h-3 w-full bg-slate-100 rounded-md" />
              <div className="h-3 w-2/3 bg-slate-100 rounded-md" />
            </div>
            <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
              <div className="h-4 w-24 bg-slate-100 rounded-md" />
              <div className="h-8 w-24 bg-lilac-100 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
