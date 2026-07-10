import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface StudentInput {
  full_name: string;
  document_number: string;
  phone: string;
  email: string;
  professional_title?: string | null;
  notes?: string | null;
}

interface RequestBody {
  course_id: string;
  student: StudentInput;
}

export async function POST(req: Request) {
  try {
    const body: RequestBody = await req.json();
    const { course_id, student } = body;

    // Validaciones básicas del servidor
    if (!course_id || !student?.full_name || !student?.document_number || !student?.phone || !student?.email) {
      return NextResponse.json({ error: "Datos incompletos. Por favor completa todos los campos obligatorios." }, { status: 400 });
    }

    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(student.email)) {
      return NextResponse.json({ error: "Correo electrónico inválido." }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Verificar que el curso existe y está activo
    const { data: course, error: courseErr } = await supabase
      .from("cursos")
      .select("id, name, status, max_students")
      .eq("id", course_id)
      .eq("status", "active")
      .single();

    if (courseErr || !course) {
      return NextResponse.json({ error: "El curso solicitado no está disponible o ya finalizó." }, { status: 404 });
    }

    // 2. Verificar cupos disponibles (si max_students está definido)
    if (course.max_students) {
      const { count } = await supabase
        .from("curso_inscripciones")
        .select("id", { count: "exact", head: true })
        .eq("course_id", course_id)
        .in("status", ["enrolled"]);

      if (count !== null && count >= course.max_students) {
        return NextResponse.json({ error: "Lo sentimos, el curso ya no tiene cupos disponibles." }, { status: 409 });
      }
    }

    // 3. Buscar o crear alumno por cédula
    let studentId: string;
    const { data: existingStudent } = await supabase
      .from("alumnos")
      .select("id")
      .eq("document_number", student.document_number)
      .maybeSingle();

    if (existingStudent) {
      studentId = existingStudent.id;

      // Actualizar datos del alumno si cambió algo
      await supabase
        .from("alumnos")
        .update({
          full_name: student.full_name,
          phone: student.phone,
          email: student.email,
          professional_title: student.professional_title || null,
          notes: student.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", studentId);
    } else {
      // Verificar si ya existe con ese email
      const { data: byEmail } = await supabase
        .from("alumnos")
        .select("id")
        .eq("email", student.email)
        .maybeSingle();

      if (byEmail) {
        studentId = byEmail.id;
      } else {
        // Crear nuevo alumno
        const { data: newStudent, error: createErr } = await supabase
          .from("alumnos")
          .insert({
            full_name: student.full_name,
            document_number: student.document_number,
            phone: student.phone,
            email: student.email,
            professional_title: student.professional_title || null,
            notes: student.notes || null,
          })
          .select("id")
          .single();

        if (createErr || !newStudent) {
          console.error("Error creando alumno:", createErr);
          return NextResponse.json({ error: "No se pudo registrar tu información. Intenta nuevamente." }, { status: 500 });
        }

        studentId = newStudent.id;
      }
    }

    // 4. Verificar si ya está inscrito en este curso
    const { data: existingEnrollment } = await supabase
      .from("curso_inscripciones")
      .select("id, status")
      .eq("course_id", course_id)
      .eq("student_id", studentId)
      .maybeSingle();

    if (existingEnrollment) {
      if (existingEnrollment.status === "enrolled") {
        return NextResponse.json(
          { error: "Ya tienes una inscripción activa en este curso." },
          { status: 409 }
        );
      }

      // Si estaba dado de baja, reactivar
      const { data: reactivated } = await supabase
        .from("curso_inscripciones")
        .update({ status: "enrolled", updated_at: new Date().toISOString() })
        .eq("id", existingEnrollment.id)
        .select("id")
        .single();

      return NextResponse.json({ enrollment_id: reactivated?.id, reactivated: true });
    }

    // 5. Crear la inscripción
    const { data: enrollment, error: enrollErr } = await supabase
      .from("curso_inscripciones")
      .insert({
        course_id,
        student_id: studentId,
        status: "enrolled",
        notes: `Inscripción web pública - ${new Date().toLocaleDateString("es-EC")}`,
      })
      .select("id")
      .single();

    if (enrollErr || !enrollment) {
      console.error("Error creando inscripción:", enrollErr);
      return NextResponse.json({ error: "No se pudo completar la inscripción. Intenta nuevamente." }, { status: 500 });
    }

    return NextResponse.json({ enrollment_id: enrollment.id }, { status: 201 });
  } catch (err) {
    console.error("Error en /api/cursos/inscribirse:", err);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
