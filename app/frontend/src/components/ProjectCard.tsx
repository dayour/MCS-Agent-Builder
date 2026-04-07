import { Link } from "react-router";
import { FolderOpen, Bot, FileText, Clock, Trash2 } from "lucide-react";
import type { Project } from "@/types";
import StatusBadge from "./StatusBadge";
import ReadinessRing from "./ReadinessRing";
import { Button } from "@/components/ui/button";

interface ProjectCardProps {
  project: Project;
  onDelete?: (id: string) => void;
}

const ProjectCard = ({ project, onDelete }: ProjectCardProps) => (
  <div className="group relative flex flex-col rounded-xl border border-border bg-card shadow-[var(--shadow-card-val)] transition-all duration-200 hover:shadow-[var(--shadow-card-hover-val)] hover:border-primary/30">
    <Link to={`/project/${project.id}`} className="flex flex-col flex-1 p-5">
      <div className="mb-3.5 flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--brand-background))]">
          <FolderOpen className="h-5 w-5 text-primary" />
        </div>
        <ReadinessRing value={project.readiness} />
      </div>

      <h3 className="mb-1 text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
        {project.name}
      </h3>
      <p className="mb-4 text-xs leading-relaxed text-muted-foreground line-clamp-2">
        {project.description}
      </p>

      <div className="mt-auto flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Bot className="h-3 w-3" /> {project.agentCount}
          </span>
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" /> {project.docCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={project.status} />
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" /> {project.updatedAt}
          </span>
        </div>
      </div>
    </Link>
    {onDelete && (
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-3 right-3 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10"
        onClick={(e) => { e.preventDefault(); onDelete(project.id); }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    )}
  </div>
);

export default ProjectCard;
