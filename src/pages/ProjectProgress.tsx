/**
 * صفحة تقدم المشروع - Project Progress & Documentation
 * تعرض شرح كامل عن بناء المشروع والميزات المنجزة والقيد الإنجاز والمخطط
 */

import { useMemo } from "react";
import { useProject } from "../context/useProject";
import { projectProgressStyles } from "./ProjectProgressStyles";

const PROJECT_SECTIONS = [
  {
    id: "core-foundation",
    title: "1. الأساس الأساسي للمشروع",
    description: "البنية التحتية الأساسية للتطبيق",
    status: "completed" as const,
    items: [
      { label: "React 19 + TypeScript", status: "completed" },
      { label: "Vite كأداة البناء", status: "completed" },
      { label: "نظام إدارة الحالة المركزية (Context API)", status: "completed" },
      { label: "تخزين البيانات في localStorage", status: "completed" },
    ],
  },
  {
    id: "viewer-3d",
    title: "2. محرك العرض ثلاثي الأبعاد (3D Viewer)",
    description: "نظام العرض والتفاعل مع النماذج ثلاثية الأبعاد",
    status: "in-progress" as const,
    items: [
      { label: "Three.js كمحرك رسومات", status: "completed" },
      { label: "عرض النماذج GLB", status: "completed" },
      { label: "الإضاءة والظلال الأساسية", status: "completed" },
      { label: "أدوات التحكم (Move, Rotate, Select)", status: "completed" },
      { label: "نظام المواد PBR (Physically Based Rendering)", status: "in-progress" },
      { label: "محاكاة HDRI وإضاءة متقدمة", status: "in-progress" },
      { label: "الرؤية ثنائية الأبعاد (2D Views)", status: "completed" },
    ],
  },
  {
    id: "layout-system",
    title: "3. نظام التخطيط الديناميكي (Layout System)",
    description: "ترتيب الصناديق والمكونات في الفضاء",
    status: "in-progress" as const,
    items: [
      { label: "إنشاء صناديق جديدة", status: "completed" },
      { label: "حساب الأبعاد والمواضع تلقائياً", status: "completed" },
      { label: "كشف التصادمات بين الأشياء", status: "in-progress" },
      { label: "تحسين التخطيط الذكي", status: "planned" },
    ],
  },
  {
    id: "ui-components",
    title: "4. واجهة المستخدم (UI Components)",
    description: "الواجهات والألواح والمكونات البصرية",
    status: "completed" as const,
    items: [
      { label: "اللوحة اليسرى (Left Panel) مع التبويبات", status: "completed" },
      { label: "أدوات اليمين (Right Tools Bar)", status: "completed" },
      { label: "شريط الأدوات العلوي (Header/Toolbar)", status: "completed" },
      { label: "الألوان والتصميم (Dark Theme)", status: "completed" },
      { label: "الاستجابة والتكيف (Responsive Design)", status: "in-progress" },
    ],
  },
  {
    id: "calculations",
    title: "5. حسابات القطع والتكاليف",
    description: "حساب قوائم القطع والأسعار والمواد",
    status: "completed" as const,
    items: [
      { label: "خوارزمية حساب الأجزاء", status: "completed" },
      { label: "قائمة القطع (Cut List)", status: "completed" },
      { label: "حساب الأسعار التلقائي", status: "completed" },
      { label: "حساب الهدر والمواد", status: "completed" },
      { label: "تقارير مفصلة بصيغة PDF", status: "completed" },
    ],
  },
  {
    id: "catalog",
    title: "6. نظام الكتالوج والنماذج",
    description: "مكتبة الأثاث والملحقات والنماذج المسبقة",
    status: "in-progress" as const,
    items: [
      { label: "مؤشر الكتالوج (Catalog Index)", status: "completed" },
      { label: "أنواع البيانات للمنتجات", status: "completed" },
      { label: "نماذج الأثاث الجاهزة (Templates)", status: "completed" },
      { label: "إدارة النماذج المخصصة", status: "in-progress" },
      { label: "مكتبة الملحقات المتقدمة", status: "planned" },
    ],
  },
  {
    id: "export-import",
    title: "7. التصدير والاستيراد",
    description: "حفظ وتحميل المشاريع والملفات",
    status: "completed" as const,
    items: [
      { label: "حفظ المشاريع في localStorage", status: "completed" },
      { label: "تحميل المشاريع المحفوظة", status: "completed" },
      { label: "تصدير PDF متقدم", status: "completed" },
      { label: "تصدير صور (رندر الـ 3D)", status: "in-progress" },
      { label: "تصدير ملفات CAD (إذا أمكن)", status: "planned" },
    ],
  },
  {
    id: "admin-deploy",
    title: "8. نظام الإدارة والنشر",
    description: "أدوات الإدارة والتحديثات التلقائية",
    status: "completed" as const,
    items: [
      { label: "لوحة التحكم الإدارية (Admin Panel)", status: "completed" },
      { label: "نظام الإصدارات (Versioning)", status: "completed" },
      { label: "سجل النشر (Deploy Log)", status: "completed" },
      { label: "النشر التلقائي (CI/CD)", status: "completed" },
      { label: "رصد الأخطاء والتحديثات", status: "in-progress" },
    ],
  },
  {
    id: "documentation",
    title: "9. التوثيق والمراجع",
    description: "مراجع شاملة عن النظام والهندسة",
    status: "completed" as const,
    items: [
      { label: "لوحة المراجع (Painel de Referência)", status: "completed" },
      { label: "شرح العمارة البرمجية", status: "completed" },
      { label: "توثيق API الـ Viewer", status: "in-progress" },
      { label: "أمثلة عملية وحالات استخدام", status: "planned" },
    ],
  },
];

const STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  completed: {
    label: "✓ تم الإنجاز",
    color: "#22c55e",
    bgColor: "rgba(34, 197, 94, 0.1)",
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
  "in-progress": {
    label: "⚙ قيد الإنجاز",
    color: "#3b82f6",
    bgColor: "rgba(59, 130, 246, 0.1)",
    borderColor: "rgba(59, 130, 246, 0.3)",
  },
  planned: {
    label: "→ مخطط",
    color: "#f59e0b",
    bgColor: "rgba(245, 158, 11, 0.1)",
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
};

export default function ProjectProgress() {
  const { project } = useProject();

  const stats = useMemo(() => {
    let completed = 0;
    let inProgress = 0;
    let planned = 0;

    PROJECT_SECTIONS.forEach((section) => {
      section.items.forEach((item) => {
        if (item.status === "completed") completed++;
        else if (item.status === "in-progress") inProgress++;
        else if (item.status === "planned") planned++;
      });
    });

    const total = completed + inProgress + planned;
    const completionPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { completed, inProgress, planned, total, completionPercent };
  }, []);

  const formattedChangelog = useMemo(
    () =>
      project.changelog
        .slice(0, 15)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .map((entry) => ({
          ...entry,
          time: new Date(entry.timestamp).toLocaleString("pt-PT"),
        })),
    [project.changelog]
  );

  return (
    <main style={projectProgressStyles.main}>
      {/* Header Section */}
      <section style={projectProgressStyles.header}>
        <div style={projectProgressStyles.headerContent}>
          <h1 style={projectProgressStyles.title}>تقدم المشروع</h1>
          <p style={projectProgressStyles.subtitle}>
            تتبع شامل لبناء وتطوير نظام PIMO Studio
          </p>
        </div>

        {/* Progress Stats */}
        <div style={projectProgressStyles.statsContainer}>
          <div style={projectProgressStyles.statBox}>
            <div style={{ ...projectProgressStyles.statNumber, color: "#22c55e" }}>
              {stats.completed}
            </div>
            <div style={projectProgressStyles.statLabel}>تم الإنجاز</div>
          </div>
          <div style={projectProgressStyles.statBox}>
            <div style={{ ...projectProgressStyles.statNumber, color: "#3b82f6" }}>
              {stats.inProgress}
            </div>
            <div style={projectProgressStyles.statLabel}>قيد الإنجاز</div>
          </div>
          <div style={projectProgressStyles.statBox}>
            <div style={{ ...projectProgressStyles.statNumber, color: "#f59e0b" }}>
              {stats.planned}
            </div>
            <div style={projectProgressStyles.statLabel}>مخطط</div>
          </div>
          <div style={projectProgressStyles.statBox}>
            <div style={{ ...projectProgressStyles.statNumber, color: "#8b5cf6" }}>
              {stats.completionPercent}%
            </div>
            <div style={projectProgressStyles.statLabel}>الإكمال</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={projectProgressStyles.progressBar}>
          <div
            style={{
              ...projectProgressStyles.progressFill,
              width: `${stats.completionPercent}%`,
            }}
          />
        </div>
      </section>

      {/* Sections */}
      <section style={projectProgressStyles.sectionsContainer}>
        {PROJECT_SECTIONS.map((section) => (
          <div key={section.id} style={projectProgressStyles.sectionCard}>
            <div style={projectProgressStyles.sectionHeader}>
              <h2 style={projectProgressStyles.sectionTitle}>{section.title}</h2>
              <p style={projectProgressStyles.sectionDesc}>{section.description}</p>
            </div>

            <div style={projectProgressStyles.itemsList}>
              {section.items.map((item, idx) => {
                const config = STATUS_CONFIG[item.status];
                return (
                  <div
                    key={idx}
                    style={{
                      ...projectProgressStyles.item,
                      borderLeftColor: config.color,
                      backgroundColor: config.bgColor,
                    }}
                  >
                    <div style={projectProgressStyles.itemContent}>
                      <div style={projectProgressStyles.itemLabel}>{item.label}</div>
                      <div
                        style={{
                          ...projectProgressStyles.itemStatus,
                          color: config.color,
                        }}
                      >
                        {config.label}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {/* Changelog Section */}
      <section style={projectProgressStyles.changelogSection}>
        <h2 style={projectProgressStyles.changelogTitle}>آخر التحديثات التلقائية</h2>
        <div style={projectProgressStyles.changelogList}>
          {formattedChangelog.length > 0 ? (
            formattedChangelog.map((entry, idx) => (
              <div key={idx} style={projectProgressStyles.changelogItem}>
                <div style={projectProgressStyles.changelogTime}>{entry.time}</div>
                <div style={projectProgressStyles.changelogMessage}>{entry.message}</div>
              </div>
            ))
          ) : (
            <div style={projectProgressStyles.noChangelog}>لا توجد تحديثات بعد</div>
          )}
        </div>
      </section>

      {/* Footer Info */}
      <section style={projectProgressStyles.footerInfo}>
        <div style={projectProgressStyles.infoBox}>
          <h3 style={projectProgressStyles.infoTitle}>🚀 عن المشروع</h3>
          <p style={projectProgressStyles.infoText}>
            PIMO Studio هو نظام متكامل لتصميم وتخطيط الأثاث ثلاثي الأبعاد مع حسابات تفصيلية للتكاليف والمواد.
            تم بناؤه باستخدام أحدث التقنيات مثل React 19 و Three.js والـ TypeScript، مع التركيز على الأداء والسهولة.
          </p>
        </div>
        <div style={projectProgressStyles.infoBox}>
          <h3 style={projectProgressStyles.infoTitle}>📊 الإحصائيات</h3>
          <p style={projectProgressStyles.infoText}>
            إجمالي الميزات: {stats.total} | العاملة: {stats.completed} | التطوير: {stats.inProgress} |
            المخطط: {stats.planned}
          </p>
        </div>
      </section>
    </main>
  );
}
