import { Award, Search } from "lucide-react";

export default function ProfesoresLoading() {
  return (
    <div className="max-w-6xl mx-auto pb-10 space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-lilac-100 flex items-center justify-center text-lilac-400">
            <Award size={24} />
          </div>
          <div className="space-y-2">
            <div className="h-6 w-64 bg-slate-200 rounded-lg" />
            <div className="h-3 w-80 bg-slate-100 rounded-md" />
          </div>
        </div>
      </div>

      {/* Search Bar Skeleton */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="h-10 flex-1 bg-slate-100 rounded-xl" />
        <div className="h-10 w-32 bg-lilac-100 rounded-xl" />
      </div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="card p-5 bg-white border border-slate-100 rounded-3xl space-y-4 shadow-2xs">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-slate-100 shrink-0" />
              <div className="space-y-2 flex-1 min-w-0">
                <div className="h-5 w-3/4 bg-slate-200 rounded-md" />
                <div className="h-3 w-1/2 bg-slate-100 rounded-md" />
              </div>
            </div>
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="h-3 w-full bg-slate-100 rounded-md" />
              <div className="h-3 w-2/3 bg-slate-100 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
