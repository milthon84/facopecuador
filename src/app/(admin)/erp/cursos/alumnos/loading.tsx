import { Users, Search } from "lucide-react";

export default function AlumnosLoading() {
  return (
    <div className="max-w-6xl mx-auto pb-10 space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-lilac-100 flex items-center justify-center text-lilac-400">
            <Users size={24} />
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

      {/* List Table Skeleton */}
      <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-2xs space-y-3">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="flex items-center justify-between p-3 border-b border-slate-50 gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-full bg-slate-100 shrink-0" />
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="h-4 w-48 bg-slate-200 rounded-md" />
                <div className="h-3 w-32 bg-slate-100 rounded-md" />
              </div>
            </div>
            <div className="h-4 w-28 bg-slate-100 rounded-md shrink-0" />
            <div className="h-8 w-20 bg-lilac-100 rounded-xl shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
