"use client";

import { useRouter } from "next/navigation";

interface Course {
  id: string;
  name: string;
}

interface Props {
  courses: Course[];
  defaultValue: string;
}

export default function CourseNoticeSelector({ courses, defaultValue }: Props) {
  const router = useRouter();

  return (
    <select
      name="courseId"
      required
      value={defaultValue}
      onChange={(e) => {
        router.push(`/erp/cursos/avisos?course_id=${e.target.value}`);
      }}
      className="input text-xs"
    >
      <option value="">Selecciona un curso activo...</option>
      {courses.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
