"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Info,
  AlertTriangle,
  Activity,
  Heart,
  Save,
  RotateCcw,
  Sparkles,
  FileText,
  CheckCircle2,
} from "lucide-react";

interface Patient {
  id: string;
  full_name: string;
  document_number?: string;
  phone?: string;
  email?: string;
}

interface Appointment {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  reason?: string | null;
}

interface AtencionClientPageProps {
  appointment: Appointment;
  patient: Patient;
  initialConsultation?: any;
  pastConsultations?: any[];
}

export default function AtencionClientPage({ appointment, patient, initialConsultation, pastConsultations = [] }: AtencionClientPageProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"ficha" | "odontogram" | "evolucion">("ficha");

  // Collapsed sections by default
  const [medicalHistoryExpanded, setMedicalHistoryExpanded] = useState(false);
  const [stomatognathicExpanded, setStomatognathicExpanded] = useState(false);
  
  // Permanent physical details
  const [birthDate, setBirthDate] = useState("");
  const [sex, setSex] = useState("");
  const [address, setAddress] = useState("");

  // Loading record from database
  const [loadingRecord, setLoadingRecord] = useState(true);

  // Pathologies / Medical history checkboxes
  const [medicalHistory, setMedicalHistory] = useState({
    alergia_antibiotico: false,
    alergia_anestesia: false,
    hemorragias: false,
    vih_sida: false,
    tuberculosis: false,
    diabetes: false,
    asma: false,
    hipertension: false,
    cardiovasculares: false,
    otros: "",
  });

  // Stomatognathic exam
  const [stomatognathic, setStomatognathic] = useState({
    labios: { status: "normal", desc: "" },
    mejillas: { status: "normal", desc: "" },
    maxilar_superior: { status: "normal", desc: "" },
    maxilar_inferior: { status: "normal", desc: "" },
    lengua: { status: "normal", desc: "" },
    paladar: { status: "normal", desc: "" },
    amigdalas: { status: "normal", desc: "" },
    otros: { status: "normal", desc: "" },
  });

  // Odontogram configuration
  const [dentitionMode, setDentitionMode] = useState<"adulta" | "infantil">("adulta");
  const [selectedTool, setSelectedTool] = useState<string>("caries");
  const [odontogram, setOdontogram] = useState<Record<string, any>>({});

  // Evolution & prescription inputs
  const [treatmentNotes, setTreatmentNotes] = useState(initialConsultation?.treatment_notes || "");
  const [prescription, setPrescription] = useState(initialConsultation?.prescription || "");

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Load existing patient records if they exist
  useEffect(() => {
    async function loadRecord() {
      try {
        const res = await fetch(`/api/admin/dental-records?patient_id=${patient.id}`);
        if (!res.ok) throw new Error("Error fetching record");
        const data = await res.json();
        
        if (data.record) {
          const rec = data.record;
          if (rec.date_of_birth) {
            const bDate = rec.date_of_birth.substring(0, 10);
            setBirthDate(bDate);
            
            // Calculate age
            const birthDateObj = new Date(bDate);
            const today = new Date();
            let age = today.getFullYear() - birthDateObj.getFullYear();
            const m = today.getMonth() - birthDateObj.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDateObj.getDate())) {
              age--;
            }
            
            // Default to infantil if age <= 12
            const hasChildTeeth = rec.odontogram_state && Object.keys(rec.odontogram_state).some((toothNumStr) => {
              const tNum = parseInt(toothNumStr, 10);
              return tNum >= 51 && tNum <= 85;
            });
            if (!hasChildTeeth) {
              setDentitionMode(age <= 12 ? "infantil" : "adulta");
            }
          }
          if (rec.sex) setSex(rec.sex);
          if (rec.address) setAddress(rec.address);
          
          if (rec.medical_history) {
            setMedicalHistory((prev) => ({
              ...prev,
              ...rec.medical_history,
            }));
          }
          
          if (rec.stomatognathic_exam) {
            setStomatognathic((prev) => ({
              ...prev,
              ...rec.stomatognathic_exam,
            }));
          }
          
          if (rec.odontogram_state) {
            setOdontogram(rec.odontogram_state);
            const hasChildTeeth = Object.keys(rec.odontogram_state).some((toothNumStr) => {
              const tNum = parseInt(toothNumStr, 10);
              return tNum >= 51 && tNum <= 85;
            });
            if (hasChildTeeth) {
              setDentitionMode("infantil");
            }
          }
        }
      } catch (err) {
        console.error("No se pudo cargar ficha dental anterior:", err);
      } finally {
        setLoadingRecord(false);
      }
    }
    loadRecord();
  }, [patient.id]);

  // Automatically change dentition mode when birthDate changes
  useEffect(() => {
    if (birthDate) {
      const birthDateObj = new Date(birthDate);
      const today = new Date();
      let age = today.getFullYear() - birthDateObj.getFullYear();
      const m = today.getMonth() - birthDateObj.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDateObj.getDate())) {
        age--;
      }
      setDentitionMode(age <= 12 ? "infantil" : "adulta");
    }
  }, [birthDate]);

  // Handle Odontogram interactions — simbología MSP Ecuador
  const WHOLE_TOOTH_TOOLS = [
    "extraccion","perdida_caries","perdida_otra",
    "sellante_necesario","sellante_realizado",
    "endodoncia_nec","endodoncia_real",
    "corona","protesis_fija","protesis_removible","protesis_total",
  ];
  const MOVILIDAD_TOOLS = ["movilidad_1","movilidad_2","movilidad_3"];
  const RECESION_TOOLS  = ["recesion_1","recesion_2","recesion_3","recesion_4"];

  const handleSurfaceClick = (toothNum: number, surface: string, tool: string) => {
    setOdontogram((prev) => {
      const tooth = prev[toothNum] || { general: "sano", surfaces: {} };
      const surfaces = { ...tooth.surfaces };

      if (WHOLE_TOOTH_TOOLS.includes(tool)) {
        return { ...prev, [toothNum]: { ...tooth, general: tooth.general === tool ? "sano" : tool } };
      } else if (MOVILIDAD_TOOLS.includes(tool)) {
        const grade = Number(tool.split("_")[1]);
        return { ...prev, [toothNum]: { ...tooth, movilidad: tooth.movilidad === grade ? null : grade } };
      } else if (RECESION_TOOLS.includes(tool)) {
        const grade = Number(tool.split("_")[1]);
        return { ...prev, [toothNum]: { ...tooth, recesion: tooth.recesion === grade ? null : grade } };
      } else if (tool === "sano") {
        delete surfaces[surface];
        return { ...prev, [toothNum]: { ...tooth, surfaces } };
      } else {
        surfaces[surface] = surfaces[surface] === tool ? "sano" : tool;
        return { ...prev, [toothNum]: { ...tooth, surfaces } };
      }
    });
  };

  const handleClearTooth = (toothNum: number) => {
    setOdontogram((prev) => {
      const updated = { ...prev };
      delete updated[toothNum];
      return updated;
    });
  };

  const handleResetAllOdontogram = () => {
    if (confirm("¿Estás seguro de que quieres restablecer todo el odontograma? Se perderán los cambios sin guardar.")) {
      setOdontogram({});
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!treatmentNotes.trim()) {
      setErrorMsg("Debe ingresar la evolución clínica o tratamientos realizados.");
      setActiveTab("evolucion");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");
    let isRedirecting = false;

    try {
      const res = await fetch("/api/admin/dental-consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_id: appointment.id,
          patient_id: patient.id,
          date_of_birth: birthDate || null,
          sex: sex || null,
          address: address || null,
          medical_history: medicalHistory,
          stomatognathic_exam: stomatognathic,
          odontogram_state: odontogram,
          treatment_notes: treatmentNotes,
          prescription: prescription || null,
          dentition_mode: dentitionMode,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ocurrió un error al guardar");

      isRedirecting = true;
      router.refresh();
      router.push("/erp");
    } catch (err: any) {
      setErrorMsg(err.message || "Error al registrar la atención.");
    } finally {
      if (!isRedirecting) {
        setIsSubmitting(false);
      }
    }
  };

  // Dentition mappings
  const adultUpperQuad1 = [18, 17, 16, 15, 14, 13, 12, 11];
  const adultUpperQuad2 = [21, 22, 23, 24, 25, 26, 27, 28];
  const adultLowerQuad4 = [48, 47, 46, 45, 44, 43, 42, 41];
  const adultLowerQuad3 = [31, 32, 33, 34, 35, 36, 37, 38];

  const childUpperQuad5 = [55, 54, 53, 52, 51];
  const childUpperQuad6 = [61, 62, 63, 64, 65];
  const childLowerQuad8 = [85, 84, 83, 82, 81];
  const childLowerQuad7 = [71, 72, 73, 74, 75];

  // Simbología según normativa MSP Ecuador (Historia Clínica Única Odontología)
  const tools = [
    { id: "caries",             sym: "■", symColor: "#ef4444", label: "Caries",              color: "bg-red-500 border-red-600 text-white",          desc: "Superficie cariada — rojo (6.16)" },
    { id: "obturacion",         sym: "■", symColor: "#3b82f6", label: "Obturación",           color: "bg-blue-600 border-blue-700 text-white",         desc: "Superficie obturada — azul (6.15)" },
    { id: "extraccion",         sym: "✕", symColor: "#ef4444", label: "Extracción ind.",      color: "bg-white border-red-500 text-red-600",           desc: "X Roja — extracción indicada (6.6)" },
    { id: "perdida_caries",     sym: "✕", symColor: "#3b82f6", label: "Perdida caries",       color: "bg-white border-blue-500 text-blue-700",         desc: "X Azul — perdida por caries (6.7)" },
    { id: "perdida_otra",       sym: "⊗", symColor: "#3b82f6", label: "Perdida otra causa",   color: "bg-white border-blue-600 text-blue-700",         desc: "X+○ Azul — perdida otra causa (6.8)" },
    { id: "sellante_necesario", sym: "*", symColor: "#ef4444", label: "Sellante nec.",        color: "bg-red-50 border-red-400 text-red-700",          desc: "* Rojo — sellante necesario (6.4)" },
    { id: "sellante_realizado", sym: "*", symColor: "#3b82f6", label: "Sellante real.",       color: "bg-blue-50 border-blue-400 text-blue-700",       desc: "* Azul — sellante realizado (6.5)" },
    { id: "endodoncia_nec",     sym: "△", symColor: "#ef4444", label: "Endodoncia nec.",      color: "bg-red-100 border-red-500 text-red-700",         desc: "△ Rojo — endodoncia indicada (6.9)" },
    { id: "endodoncia_real",    sym: "△", symColor: "#3b82f6", label: "Endodoncia real.",     color: "bg-blue-100 border-blue-500 text-blue-700",      desc: "△ Azul — endodoncia realizada (6.10)" },
    { id: "corona",             sym: "○", symColor: "#3b82f6", label: "Corona",               color: "bg-white border-blue-600 text-blue-800",         desc: "○ Azul — corona protésica (6.14)" },
    { id: "protesis_fija",      sym: "⋯", symColor: "#3b82f6", label: "Prótesis fija",        color: "bg-blue-50 border-blue-400 text-blue-700",       desc: "⋯ Azul — prótesis fija (6.11)" },
    { id: "protesis_removible", sym: "(⋯)", symColor: "#3b82f6", label: "Prót. removible",   color: "bg-blue-50 border-blue-300 text-blue-600",       desc: "(⋯) Azul — prótesis removible (6.12)" },
    { id: "protesis_total",     sym: "=", symColor: "#3b82f6", label: "Prótesis total",       color: "bg-blue-100 border-blue-600 text-blue-800",      desc: "= Azul — prótesis total (6.13)" },
    { id: "movilidad_1",        sym: "1", symColor: "#f97316", label: "Movilidad G1",         color: "bg-orange-50 border-orange-400 text-orange-700", desc: "Movilidad grado 1 — Miller (6.1)" },
    { id: "movilidad_2",        sym: "2", symColor: "#f97316", label: "Movilidad G2",         color: "bg-orange-100 border-orange-500 text-orange-800", desc: "Movilidad grado 2 — Miller (6.1)" },
    { id: "movilidad_3",        sym: "3", symColor: "#f97316", label: "Movilidad G3",         color: "bg-orange-200 border-orange-600 text-orange-900", desc: "Movilidad grado 3 — Miller (6.1)" },
    { id: "recesion_1",         sym: "R1", symColor: "#9333ea", label: "Recesión G1",         color: "bg-purple-50 border-purple-400 text-purple-700", desc: "Recesión grado 1 — Miller (6.2)" },
    { id: "recesion_2",         sym: "R2", symColor: "#9333ea", label: "Recesión G2",         color: "bg-purple-100 border-purple-500 text-purple-800", desc: "Recesión grado 2 — Miller (6.2)" },
    { id: "recesion_3",         sym: "R3", symColor: "#9333ea", label: "Recesión G3",         color: "bg-purple-200 border-purple-600 text-purple-900", desc: "Recesión grado 3 — Miller (6.2)" },
    { id: "recesion_4",         sym: "R4", symColor: "#9333ea", label: "Recesión G4",         color: "bg-purple-300 border-purple-700 text-purple-900", desc: "Recesión grado 4 — Miller (6.2)" },
    { id: "sano",               sym: "✗", symColor: "#1f2937", label: "Borrador",             color: "bg-ink-900 text-white border-ink-900",           desc: "Limpiar condición de la superficie" },
  ];

  const hasRiskFactors = Object.entries(medicalHistory).some(([k, v]) => k !== "otros" && v === true);
  const hasStomatognathicAlterations = Object.values(stomatognathic).some(
    (exam: any) => exam?.status === "alteracion"
  );

  const renderPastConsultations = () => (
    <div className="card p-6 bg-white border border-lilac-100 shadow-sm rounded-2xl">
      <h2 className="text-sm font-bold text-ink-950 flex items-center gap-2 mb-4 border-b border-lilac-50 pb-2">
        <Activity size={16} className="text-lilac-700 animate-pulse" /> Evoluciones Anteriores ({pastConsultations.length})
      </h2>
      
      {pastConsultations.length === 0 ? (
        <div className="text-xs text-ink-500 italic py-4 text-center">
          No se registran evoluciones previas en el historial para este paciente.
        </div>
      ) : (
        <div className="space-y-4 max-h-[680px] overflow-y-auto pr-1">
          {pastConsultations.map((c) => (
            <div key={c.id} className="bg-lilac-50/30 hover:bg-lilac-50/50 p-4 rounded-xl border border-lilac-100 text-xs transition-all space-y-2">
              <div className="flex justify-between items-center border-b border-lilac-50 pb-1.5 mb-1.5">
                <span className="font-bold text-ink-900">
                  {new Date(c.created_at).toLocaleDateString("es-CO", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                  })}
                </span>
                <span className="text-[10px] text-ink-500 capitalize">
                  {new Date(c.created_at).toLocaleTimeString("es-CO", {
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </span>
              </div>
              <div>
                <span className="font-bold text-lilac-900 uppercase text-[9px] block mb-0.5">Evolución</span>
                <p className="text-ink-800 whitespace-pre-wrap leading-relaxed">{c.treatment_notes}</p>
              </div>
              {c.prescription && (
                <div className="pt-2 border-t border-lilac-50/80">
                  <span className="font-bold text-gold-800 uppercase text-[9px] block mb-0.5">Receta / Indicaciones</span>
                  <p className="text-ink-800 whitespace-pre-wrap leading-relaxed">{c.prescription}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto pb-10">
      {isSubmitting && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink/40 backdrop-blur-sm transition-all duration-300">
          <div className="bg-white/95 border border-lilac-100 rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl flex flex-col items-center text-center animate-in fade-in duration-200">
            {/* Elegant Clinic Spinner with Golden/Lilac Accents */}
            <div className="relative mb-6">
              <div className="h-16 w-16 rounded-full border-4 border-lilac-50 border-t-gold animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-lilac-600 animate-pulse">
                <Activity size={24} />
              </div>
            </div>
            <h3 className="text-xl font-bold text-ink mb-2">Finalizando Atención</h3>
            <p className="text-sm text-ink/75 leading-relaxed">
              Estamos guardando la atención en la ficha clínica y enviando el correo con el odontograma interactivo al paciente. Por favor, no cierres esta ventana.
            </p>
          </div>
        </div>
      )}

      <Link
        href={`/erp/citas/${appointment.id}`}
        className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900 mb-4 transition-colors"
      >
        <ArrowLeft size={16} /> Volver a Detalles de la Cita
      </Link>

      <div className="bg-ink-900 text-white rounded-3xl p-6 mb-6 shadow-md border border-ink-800">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-gold-400 font-bold mb-1">Registro de Ficha Odontológica</div>
            <h1 className="text-2xl font-bold text-gold-500">{patient.full_name}</h1>
            <p className="text-xs text-lilac-200 mt-0.5">
              Cédula: {patient.document_number || "No registrada"} · Tel: {patient.phone || "No registrado"}
            </p>
          </div>
          <div className="bg-ink-800/80 border border-gold-900/50 rounded-xl px-4 py-2 text-right">
            <div className="text-[10px] text-gold-400 uppercase font-semibold">Cita Actual</div>
            <div className="text-sm font-medium">
              {new Date(appointment.starts_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}
            </div>
            <div className="text-xs text-lilac-300 capitalize">
              {new Date(appointment.starts_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />
          <div>
            <div className="font-semibold text-sm">Error al procesar</div>
            <div className="text-xs">{errorMsg}</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-lilac-100 mb-6 overflow-x-auto gap-2 bg-white p-1.5 rounded-2xl shadow-sm border">
        <button
          type="button"
          onClick={() => setActiveTab("ficha")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === "ficha"
              ? "bg-lilac-100 text-lilac-900 shadow-sm"
              : "text-ink-600 hover:bg-lilac-50/50"
          }`}
        >
          <Activity size={16} /> 1. Antecedentes y Examen Físico
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("odontogram")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === "odontogram"
              ? "bg-lilac-100 text-lilac-900 shadow-sm"
              : "text-ink-600 hover:bg-lilac-50/50"
          }`}
        >
          <Sparkles size={16} className="text-gold-600" /> 2. Odontograma Interactivo
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("evolucion")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === "evolucion"
              ? "bg-lilac-100 text-lilac-900 shadow-sm"
              : "text-ink-600 hover:bg-lilac-50/50"
          }`}
        >
          <FileText size={16} /> 3. Evolución y Prescripción
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        <div className={activeTab === "odontogram" ? "lg:col-span-3" : "lg:col-span-2"}>
          <form onSubmit={handleSubmit}>
            {/* Tab 1: Ficha y Antecedentes */}
        {activeTab === "ficha" && (
          <div className="space-y-6">
            <div className="card p-6 bg-white border border-lilac-100 shadow-sm">
              <h2 className="text-lg font-bold text-ink-900 mb-4 flex items-center gap-2">
                <Info className="text-gold-500" size={18} /> Datos Físicos del Paciente
              </h2>
              {loadingRecord ? (
                <div className="text-xs text-ink-600 animate-pulse py-4">Buscando ficha médica anterior...</div>
              ) : (
                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-ink-700 uppercase mb-1">Fecha de Nacimiento</label>
                    <input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full text-sm rounded-xl border border-lilac-200 px-3 py-2 bg-lilac-50/20 focus:border-lilac-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink-700 uppercase mb-1">Sexo</label>
                    <select
                      value={sex}
                      onChange={(e) => setSex(e.target.value)}
                      className="w-full text-sm rounded-xl border border-lilac-200 px-3 py-2 bg-lilac-50/20 focus:border-lilac-500 outline-none"
                    >
                      <option value="">Seleccionar...</option>
                      <option value="M">Masculino</option>
                      <option value="F">Femenino</option>
                      <option value="O">Otro</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="card bg-white border border-lilac-100 shadow-sm overflow-hidden transition-all">
              <button
                type="button"
                onClick={() => setMedicalHistoryExpanded(!medicalHistoryExpanded)}
                className="w-full flex items-center justify-between p-6 hover:bg-lilac-50/20 transition-all text-left outline-none"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Heart className="text-red-500 animate-pulse" size={18} />
                  <h2 className="text-lg font-bold text-ink-900">
                    Antecedentes Médicos (Historia de Salud)
                  </h2>
                  {!medicalHistoryExpanded && hasRiskFactors && (
                    <span className="bg-red-50 text-red-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-red-100 flex items-center gap-1 animate-pulse">
                      <AlertTriangle size={12} /> Antecedente Clínico Detectado
                    </span>
                  )}
                </div>
                {medicalHistoryExpanded ? (
                  <ChevronUp className="text-ink-500 shrink-0" size={20} />
                ) : (
                  <ChevronDown className="text-ink-500 shrink-0" size={20} />
                )}
              </button>

              {medicalHistoryExpanded && (
                <div className="px-6 pb-6 pt-0 border-t border-lilac-50">
                  <p className="text-xs text-ink-600 mb-4 pt-4">
                    Por favor, marque los diagnósticos clínicos confirmados por el paciente para alertar precauciones operatorias.
                  </p>
                  
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                      { id: "alergia_antibiotico", label: "Alergia a Antibióticos" },
                      { id: "alergia_anestesia", label: "Alergia a la Anestesia" },
                      { id: "hemorragias", label: "Problemas de Hemorragias" },
                      { id: "vih_sida", label: "VIH / SIDA" },
                      { id: "tuberculosis", label: "Tuberculosis" },
                      { id: "diabetes", label: "Diabetes Mellitus" },
                      { id: "asma", label: "Asma Bronquial" },
                      { id: "hipertension", label: "Hipertensión Arterial" },
                      { id: "cardiovasculares", label: "Enfermedades Cardíacas" },
                    ].map((item) => (
                      <label
                        key={item.id}
                        className="flex items-center gap-3 p-3 rounded-xl border border-lilac-50 hover:bg-lilac-50/30 cursor-pointer transition-all"
                      >
                        <input
                          type="checkbox"
                          checked={(medicalHistory as any)[item.id]}
                          onChange={(e) =>
                            setMedicalHistory((prev) => ({
                              ...prev,
                              [item.id]: e.target.checked,
                            }))
                          }
                          className="w-4 h-4 rounded text-lilac-600 border-lilac-300 focus:ring-lilac-500"
                        />
                        <span className="text-sm text-ink-900 font-medium">{item.label}</span>
                      </label>
                    ))}
                  </div>

                  <div className="mt-4">
                    <label className="block text-xs font-bold text-ink-700 uppercase mb-1">Otros Antecedentes / Observaciones</label>
                    <textarea
                      rows={2}
                      placeholder="Detallar alergias adicionales, medicamentos consumidos regularmente, cirugías recientes..."
                      value={medicalHistory.otros}
                      onChange={(e) =>
                        setMedicalHistory((prev) => ({
                          ...prev,
                          otros: e.target.value,
                        }))
                      }
                      className="w-full text-sm rounded-xl border border-lilac-200 px-3 py-2 bg-lilac-50/20 focus:border-lilac-500 outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="card bg-white border border-lilac-100 shadow-sm overflow-hidden transition-all">
              <button
                type="button"
                onClick={() => setStomatognathicExpanded(!stomatognathicExpanded)}
                className="w-full flex items-center justify-between p-6 hover:bg-lilac-50/20 transition-all text-left outline-none"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <CheckCircle2 className="text-gold-600" size={18} />
                  <h2 className="text-lg font-bold text-ink-900">
                    Examen del Sistema Estomatognático
                  </h2>
                  {!stomatognathicExpanded && hasStomatognathicAlterations && (
                    <span className="bg-amber-50 text-amber-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-amber-100 flex items-center gap-1">
                      <AlertTriangle size={12} /> Alteración Detectada
                    </span>
                  )}
                </div>
                {stomatognathicExpanded ? (
                  <ChevronUp className="text-ink-500 shrink-0" size={20} />
                ) : (
                  <ChevronDown className="text-ink-500 shrink-0" size={20} />
                )}
              </button>

              {stomatognathicExpanded && (
                <div className="px-6 pb-6 pt-0 border-t border-lilac-50">
                  <p className="text-xs text-ink-600 mb-4 pt-4">
                    Identifique si alguna de las siguientes zonas presenta anomalías patológicas.
                  </p>

                  <div className="space-y-4">
                    {[
                      { id: "labios", label: "1. Labios" },
                      { id: "mejillas", label: "2. Mejillas" },
                      { id: "maxilar_superior", label: "3. Maxilar Superior" },
                      { id: "maxilar_inferior", label: "4. Maxilar Inferior" },
                      { id: "lengua", label: "5. Lengua" },
                      { id: "paladar", label: "6. Paladar" },
                      { id: "amigdalas", label: "7. Amígdalas" },
                      { id: "otros", label: "8. Otros (Higiene, etc.)" },
                    ].map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-lilac-50 hover:bg-lilac-50/10"
                      >
                        <div className="sm:w-1/3">
                          <span className="text-sm font-semibold text-ink-900">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-4 sm:w-1/4">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name={`exam_${item.id}`}
                              value="normal"
                              checked={(stomatognathic as any)[item.id]?.status === "normal"}
                              onChange={() =>
                                setStomatognathic((prev) => ({
                                  ...prev,
                                  [item.id]: {
                                    ...(prev as any)[item.id],
                                    status: "normal",
                                  },
                                }))
                              }
                              className="w-4 h-4 text-lilac-600 focus:ring-lilac-500"
                            />
                            <span className="text-xs font-semibold text-ink-700">Normal</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name={`exam_${item.id}`}
                              value="alteracion"
                              checked={(stomatognathic as any)[item.id]?.status === "alteracion"}
                              onChange={() =>
                                setStomatognathic((prev) => ({
                                  ...prev,
                                  [item.id]: {
                                    ...(prev as any)[item.id],
                                    status: "alteracion",
                                  },
                                }))
                              }
                              className="w-4 h-4 text-red-600 focus:ring-red-500"
                            />
                            <span className="text-xs font-semibold text-red-700">Alteración</span>
                          </label>
                        </div>
                        <div className="flex-1">
                          {(stomatognathic as any)[item.id]?.status === "alteracion" && (
                            <input
                              type="text"
                              placeholder="Describa la alteración estomatognática hallada..."
                              value={(stomatognathic as any)[item.id]?.desc || ""}
                              onChange={(e) =>
                                setStomatognathic((prev) => ({
                                  ...prev,
                                  [item.id]: {
                                    ...(prev as any)[item.id],
                                    desc: e.target.value,
                                  },
                                }))
                              }
                              className="w-full text-xs rounded-xl border border-red-200 px-3 py-1.5 bg-red-50/20 focus:border-red-400 outline-none text-red-900"
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setActiveTab("odontogram")}
                className="inline-flex items-center justify-center bg-gold-600 hover:bg-gold-700 text-white font-medium text-sm px-6 py-2.5 rounded-xl transition-all shadow-sm gap-1"
              >
                Continuar a Odontograma <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Odontograma */}
        {activeTab === "odontogram" && (
          <div className="space-y-6">
            <div className="card p-6 bg-white border border-lilac-100 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-ink-900 flex items-center gap-2">
                    <Sparkles className="text-gold-600" size={18} /> Odontograma Clínico Interactivo
                  </h2>
                  <p className="text-xs text-ink-600 mt-0.5">
                    Seleccione una condición de la paleta inferior y haga clic en la superficie o diente correspondiente.
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setDentitionMode("adulta")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      dentitionMode === "adulta"
                        ? "bg-gold-600 text-white shadow-sm"
                        : "bg-lilac-50 text-ink-700 hover:bg-lilac-100"
                    }`}
                  >
                    Dentición Adulta
                  </button>
                  <button
                    type="button"
                    onClick={() => setDentitionMode("infantil")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      dentitionMode === "infantil"
                        ? "bg-gold-600 text-white shadow-sm"
                        : "bg-lilac-50 text-ink-700 hover:bg-lilac-100"
                    }`}
                  >
                    Dentición Infantil
                  </button>
                </div>
              </div>

              {/* Tools Palette — Simbología MSP Ecuador */}
              <div className="bg-lilac-50/55 rounded-2xl p-4 border border-lilac-100 mb-6">
                <div className="text-xs font-bold text-ink-700 uppercase mb-3">
                  Simbología — Herramienta activa: <span className="text-lilac-700">{tools.find(t => t.id === selectedTool)?.label}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tools.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTool(t.id)}
                      title={t.desc}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 ${
                        selectedTool === t.id
                          ? `${t.color} scale-105 shadow-md`
                          : "bg-white border-lilac-100 text-ink-700 hover:border-lilac-300 hover:bg-lilac-50"
                      }`}
                    >
                      <span className="font-black text-sm leading-none w-6 text-center shrink-0"
                            style={{ color: selectedTool === t.id ? "inherit" : (t as any).symColor }}>
                        {(t as any).sym}
                      </span>
                      <span className="whitespace-nowrap">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Graphic Odontogram */}
              <div className="border border-lilac-100 rounded-2xl p-4 overflow-x-auto bg-lilac-50/10">
                <div className="min-w-[760px] space-y-8 select-none py-4">
                  {dentitionMode === "adulta" ? (
                    <>
                      {/* Upper teeth */}
                      <div>
                        <div className="text-center text-[10px] font-bold text-lilac-800 uppercase tracking-widest mb-3">Piezas Superiores (Dentición Adulta)</div>
                        <div className="flex justify-between items-center relative">
                          {/* Quad 1 */}
                          <div className="flex gap-2 flex-1 justify-end pr-4">
                            {adultUpperQuad1.map((tNum) => (
                              <Tooth
                                key={tNum}
                                toothNum={tNum}
                                state={odontogram[tNum]}
                                selectedTool={selectedTool}
                                onSurfaceClick={handleSurfaceClick}
                                onClearTooth={handleClearTooth}
                              />
                            ))}
                          </div>

                          {/* Center Divider Line */}
                          <div className="absolute left-1/2 top-0 bottom-0 border-l border-dashed border-gold-500/80 w-0 z-10" />

                          {/* Quad 2 */}
                          <div className="flex gap-2 flex-1 justify-start pl-4">
                            {adultUpperQuad2.map((tNum) => (
                              <Tooth
                                key={tNum}
                                toothNum={tNum}
                                state={odontogram[tNum]}
                                selectedTool={selectedTool}
                                onSurfaceClick={handleSurfaceClick}
                                onClearTooth={handleClearTooth}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Lower teeth */}
                      <div className="pt-4 border-t border-lilac-100">
                        <div className="text-center text-[10px] font-bold text-lilac-800 uppercase tracking-widest mb-3">Piezas Inferiores (Dentición Adulta)</div>
                        <div className="flex justify-between items-center relative">
                          {/* Quad 4 */}
                          <div className="flex gap-2 flex-1 justify-end pr-4">
                            {adultLowerQuad4.map((tNum) => (
                              <Tooth
                                key={tNum}
                                toothNum={tNum}
                                state={odontogram[tNum]}
                                selectedTool={selectedTool}
                                onSurfaceClick={handleSurfaceClick}
                                onClearTooth={handleClearTooth}
                              />
                            ))}
                          </div>

                          {/* Center Divider Line */}
                          <div className="absolute left-1/2 top-0 bottom-0 border-l border-dashed border-gold-500/80 w-0 z-10" />

                          {/* Quad 3 */}
                          <div className="flex gap-2 flex-1 justify-start pl-4">
                            {adultLowerQuad3.map((tNum) => (
                              <Tooth
                                key={tNum}
                                toothNum={tNum}
                                state={odontogram[tNum]}
                                selectedTool={selectedTool}
                                onSurfaceClick={handleSurfaceClick}
                                onClearTooth={handleClearTooth}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Children Upper */}
                      <div>
                        <div className="text-center text-[10px] font-bold text-lilac-800 uppercase tracking-widest mb-3">Piezas Superiores (Dentición Infantil)</div>
                        <div className="flex justify-between items-center relative">
                          {/* Quad 5 */}
                          <div className="flex gap-3 flex-1 justify-end pr-6">
                            {childUpperQuad5.map((tNum) => (
                              <Tooth
                                key={tNum}
                                toothNum={tNum}
                                state={odontogram[tNum]}
                                selectedTool={selectedTool}
                                onSurfaceClick={handleSurfaceClick}
                                onClearTooth={handleClearTooth}
                              />
                            ))}
                          </div>

                          {/* Center Divider Line */}
                          <div className="absolute left-1/2 top-0 bottom-0 border-l border-dashed border-gold-500/80 w-0 z-10" />

                          {/* Quad 6 */}
                          <div className="flex gap-3 flex-1 justify-start pl-6">
                            {childUpperQuad6.map((tNum) => (
                              <Tooth
                                key={tNum}
                                toothNum={tNum}
                                state={odontogram[tNum]}
                                selectedTool={selectedTool}
                                onSurfaceClick={handleSurfaceClick}
                                onClearTooth={handleClearTooth}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Children Lower */}
                      <div className="pt-4 border-t border-lilac-100">
                        <div className="text-center text-[10px] font-bold text-lilac-800 uppercase tracking-widest mb-3">Piezas Inferiores (Dentición Infantil)</div>
                        <div className="flex justify-between items-center relative">
                          {/* Quad 8 */}
                          <div className="flex gap-3 flex-1 justify-end pr-6">
                            {childLowerQuad8.map((tNum) => (
                              <Tooth
                                key={tNum}
                                toothNum={tNum}
                                state={odontogram[tNum]}
                                selectedTool={selectedTool}
                                onSurfaceClick={handleSurfaceClick}
                                onClearTooth={handleClearTooth}
                              />
                            ))}
                          </div>

                          {/* Center Divider Line */}
                          <div className="absolute left-1/2 top-0 bottom-0 border-l border-dashed border-gold-500/80 w-0 z-10" />

                          {/* Quad 7 */}
                          <div className="flex gap-3 flex-1 justify-start pl-6">
                            {childLowerQuad7.map((tNum) => (
                              <Tooth
                                key={tNum}
                                toothNum={tNum}
                                state={odontogram[tNum]}
                                selectedTool={selectedTool}
                                onSurfaceClick={handleSurfaceClick}
                                onClearTooth={handleClearTooth}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center mt-5">
                <button
                  type="button"
                  onClick={handleResetAllOdontogram}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-800 transition-colors"
                >
                  <RotateCcw size={14} /> Restablecer Odontograma
                </button>
                <div className="text-xs text-ink-500 italic">
                  *Los cambios modifican directamente la ficha clínica del paciente.
                </div>
              </div>
            </div>

            <div className="flex justify-between gap-3 mt-6">
              <button
                type="button"
                onClick={() => setActiveTab("ficha")}
                className="inline-flex items-center justify-center bg-white border border-lilac-200 text-ink-700 hover:bg-lilac-50/50 font-medium text-sm px-6 py-2.5 rounded-xl transition-all gap-1"
              >
                <ChevronLeft size={16} /> Volver a Antecedentes
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("evolucion")}
                className="inline-flex items-center justify-center bg-gold-600 hover:bg-gold-700 text-white font-medium text-sm px-6 py-2.5 rounded-xl transition-all shadow-sm gap-1"
              >
                Continuar a Evolución <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Evolución y Receta */}
        {activeTab === "evolucion" && (
          <div className="space-y-6">
            <div className="card p-6 bg-white border border-lilac-100 shadow-sm">
              <h2 className="text-lg font-bold text-ink-900 mb-4 flex items-center gap-2">
                <FileText className="text-lilac-600" size={18} /> Registro Clínico de la Cita
              </h2>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-ink-700 uppercase mb-1">
                    Evolución y Procedimientos Realizados <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={6}
                    required
                    placeholder="Detalle de los procedimientos clínicos realizados en esta sesión (ej. profilaxis, resina cavidad oclusal diente 16, etc.)..."
                    value={treatmentNotes}
                    onChange={(e) => setTreatmentNotes(e.target.value)}
                    className="w-full text-sm rounded-xl border border-lilac-200 px-3 py-2 bg-lilac-50/20 focus:border-lilac-500 outline-none"
                  />
                  <p className="text-[10px] text-ink-500 mt-1">Este bloque se enviará directamente al correo del paciente.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink-700 uppercase mb-1">
                    Receta e Indicaciones Médicas (Opcional)
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Escriba medicamentos recetados, dosis e indicaciones de cuidados posteriores (ej. Paracetamol 500mg cada 8 horas por 3 días)..."
                    value={prescription}
                    onChange={(e) => setPrescription(e.target.value)}
                    className="w-full text-sm rounded-xl border border-lilac-200 px-3 py-2 bg-lilac-50/20 focus:border-lilac-500 outline-none"
                  />
                  <p className="text-[10px] text-ink-500 mt-1">Si registra una receta, se añadirá de forma destacada en el correo del paciente.</p>
                </div>
              </div>
            </div>

            <div className="flex justify-between gap-3">
              <button
                type="button"
                onClick={() => setActiveTab("odontogram")}
                className="inline-flex items-center justify-center bg-white border border-lilac-200 text-ink-700 hover:bg-lilac-50/50 font-medium text-sm px-6 py-2.5 rounded-xl transition-all gap-1"
              >
                <ChevronLeft size={16} /> Volver a Odontograma
              </button>
              
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center bg-gold-600 hover:bg-gold-700 disabled:bg-gold-300 text-white font-medium text-sm px-6 py-2.5 rounded-xl transition-all shadow-sm gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-1.5 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Guardando Cita...
                  </>
                ) : (
                  <>
                    <Save size={16} /> Finalizar Atención y Enviar Correo
                  </>
                )}
              </button>
            </div>
          </div>
        )}
          </form>
        </div>

        {/* Columnas del lado derecho: Solo visibles si no estamos en el tab de odontograma */}
        {activeTab !== "odontogram" && (
          <div className="lg:col-span-1 space-y-6">
            {renderPastConsultations()}
          </div>
        )}
      </div>
    </div>
  );
}

function Tooth({
  toothNum,
  state = {},
  selectedTool,
  onSurfaceClick,
  onClearTooth,
}: {
  toothNum: number;
  state: any;
  selectedTool: string;
  onSurfaceClick: (toothNum: number, surface: string, tool: string) => void;
  onClearTooth: (toothNum: number) => void;
}) {
  const general   = state.general   || "sano";
  const surfaces  = state.surfaces  || {};
  const movilidad = state.movilidad ?? null;
  const recesion  = state.recesion  ?? null;

  const handlePartClick = (surfaceKey: string) => {
    onSurfaceClick(toothNum, surfaceKey, selectedTool);
  };

  const getSurfaceColorClass = (surfKey: string) => {
    const cond = surfaces[surfKey];
    if (cond === "caries")     return "fill-red-500 hover:fill-red-600 stroke-red-700";
    if (cond === "obturacion") return "fill-blue-500 hover:fill-blue-600 stroke-blue-700";
    return "fill-white hover:fill-lilac-50 stroke-lilac-300";
  };

  const hasMark = general !== "sano" || Object.keys(surfaces).length > 0 || movilidad || recesion;

  return (
    <div className="flex flex-col items-center p-1.5 bg-white rounded-xl border border-lilac-50 hover:border-lilac-200 transition-all shadow-sm">
      <div className="text-[10px] font-bold text-ink-800 mb-1">{toothNum}</div>
      <div className="relative w-[50px] h-[50px]">
        <svg viewBox="0 0 60 60" className="w-full h-full">
          <polygon points="0,0 60,0 42,18 18,18"   className={`transition-colors cursor-pointer stroke-[1px] ${getSurfaceColorClass("top")}`}    onClick={() => handlePartClick("top")} />
          <polygon points="0,60 60,60 42,42 18,42"  className={`transition-colors cursor-pointer stroke-[1px] ${getSurfaceColorClass("bottom")}`} onClick={() => handlePartClick("bottom")} />
          <polygon points="0,0 18,18 18,42 0,60"    className={`transition-colors cursor-pointer stroke-[1px] ${getSurfaceColorClass("left")}`}   onClick={() => handlePartClick("left")} />
          <polygon points="60,0 42,18 42,42 60,60"  className={`transition-colors cursor-pointer stroke-[1px] ${getSurfaceColorClass("right")}`}  onClick={() => handlePartClick("right")} />
          <rect x="18" y="18" width="24" height="24" className={`transition-colors cursor-pointer stroke-[1px] ${getSurfaceColorClass("center")}`} onClick={() => handlePartClick("center")} />

          {general === "extraccion" && (<>
            <line x1="8" y1="8" x2="52" y2="52" stroke="#ef4444" strokeWidth="4.5" strokeLinecap="round" className="pointer-events-none" />
            <line x1="52" y1="8" x2="8" y2="52" stroke="#ef4444" strokeWidth="4.5" strokeLinecap="round" className="pointer-events-none" />
          </>)}
          {general === "perdida_caries" && (<>
            <line x1="8" y1="8" x2="52" y2="52" stroke="#3b82f6" strokeWidth="4.5" strokeLinecap="round" className="pointer-events-none" />
            <line x1="52" y1="8" x2="8" y2="52" stroke="#3b82f6" strokeWidth="4.5" strokeLinecap="round" className="pointer-events-none" />
          </>)}
          {general === "perdida_otra" && (<>
            <line x1="8" y1="8" x2="52" y2="52" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" className="pointer-events-none" />
            <line x1="52" y1="8" x2="8" y2="52" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" className="pointer-events-none" />
            <circle cx="30" cy="30" r="27" fill="none" stroke="#3b82f6" strokeWidth="2.5" className="pointer-events-none" />
          </>)}
          {general === "sellante_necesario" && (
            <text x="30" y="41" textAnchor="middle" fontSize="36" fontWeight="900" fill="#ef4444" className="pointer-events-none" style={{ fontFamily: "monospace" }}>*</text>
          )}
          {general === "sellante_realizado" && (
            <text x="30" y="41" textAnchor="middle" fontSize="36" fontWeight="900" fill="#3b82f6" className="pointer-events-none" style={{ fontFamily: "monospace" }}>*</text>
          )}
          {general === "endodoncia_nec" && (
            <polygon points="30,6 54,52 6,52" fill="none" stroke="#ef4444" strokeWidth="3.5" strokeLinejoin="round" className="pointer-events-none" />
          )}
          {general === "endodoncia_real" && (
            <polygon points="30,6 54,52 6,52" fill="none" stroke="#3b82f6" strokeWidth="3.5" strokeLinejoin="round" className="pointer-events-none" />
          )}
          {general === "corona" && (
            <circle cx="30" cy="30" r="27" fill="none" stroke="#3b82f6" strokeWidth="3.5" className="pointer-events-none" />
          )}
          {general === "protesis_fija" && (
            <line x1="5" y1="30" x2="55" y2="30" stroke="#3b82f6" strokeWidth="3" strokeDasharray="7 4" strokeLinecap="round" className="pointer-events-none" />
          )}
          {general === "protesis_removible" && (<>
            <text x="3" y="42" fontSize="30" fill="#3b82f6" fontWeight="bold" className="pointer-events-none">(</text>
            <line x1="17" y1="30" x2="43" y2="30" stroke="#3b82f6" strokeWidth="2.5" strokeDasharray="5 3" strokeLinecap="round" className="pointer-events-none" />
            <text x="42" y="42" fontSize="30" fill="#3b82f6" fontWeight="bold" className="pointer-events-none">)</text>
          </>)}
          {general === "protesis_total" && (<>
            <line x1="10" y1="23" x2="50" y2="23" stroke="#3b82f6" strokeWidth="3.5" strokeLinecap="round" className="pointer-events-none" />
            <line x1="10" y1="37" x2="50" y2="37" stroke="#3b82f6" strokeWidth="3.5" strokeLinecap="round" className="pointer-events-none" />
          </>)}
          {movilidad && (
            <text x="4" y="16" fontSize="14" fontWeight="900" fill="#f97316" className="pointer-events-none">{movilidad}</text>
          )}
          {recesion && (
            <text x="56" y="16" textAnchor="end" fontSize="11" fontWeight="900" fill="#9333ea" className="pointer-events-none">R{recesion}</text>
          )}
        </svg>
      </div>
      {hasMark && (
        <button type="button" onClick={() => onClearTooth(toothNum)}
          className="text-[9px] text-red-500 hover:text-red-700 mt-1 font-semibold transition-colors"
          title="Limpiar toda la pieza">
          Limpiar
        </button>
      )}
    </div>
  );
}
