import type { Artboard } from "./model";

export interface DesignHistorySnapshot {
  artboards: Artboard[];
  selectedArtboardId?: string | null;
  selectedNodeId?: string | null;
}

const MAX_HISTORY_STEPS = 50;

export class DesignHistory {
  private past: DesignHistorySnapshot[] = [];
  private future: DesignHistorySnapshot[] = [];

  private cloneArtboards(artboards: Artboard[]): Artboard[] {
    return artboards.map((a) => ({ ...a }));
  }

  push(snapshot: DesignHistorySnapshot): void {
    this.past.push({
      artboards: this.cloneArtboards(snapshot.artboards),
      selectedArtboardId: snapshot.selectedArtboardId ?? null,
      selectedNodeId: snapshot.selectedNodeId ?? null,
    });
    if (this.past.length > MAX_HISTORY_STEPS) {
      this.past.shift();
    }
    this.future = [];
  }

  canUndo(): boolean {
    return this.past.length > 0;
  }

  canRedo(): boolean {
    return this.future.length > 0;
  }

  undo(current: DesignHistorySnapshot): DesignHistorySnapshot | null {
    const prev = this.past.pop();
    if (!prev) {
      return null;
    }
    this.future.push({
      artboards: this.cloneArtboards(current.artboards),
      selectedArtboardId: current.selectedArtboardId ?? null,
      selectedNodeId: current.selectedNodeId ?? null,
    });
    return {
      artboards: this.cloneArtboards(prev.artboards),
      selectedArtboardId: prev.selectedArtboardId,
      selectedNodeId: prev.selectedNodeId,
    };
  }

  redo(current: DesignHistorySnapshot): DesignHistorySnapshot | null {
    const next = this.future.pop();
    if (!next) {
      return null;
    }
    this.past.push({
      artboards: this.cloneArtboards(current.artboards),
      selectedArtboardId: current.selectedArtboardId ?? null,
      selectedNodeId: current.selectedNodeId ?? null,
    });
    return {
      artboards: this.cloneArtboards(next.artboards),
      selectedArtboardId: next.selectedArtboardId,
      selectedNodeId: next.selectedNodeId,
    };
  }

  clear(): void {
    this.past = [];
    this.future = [];
  }
}
