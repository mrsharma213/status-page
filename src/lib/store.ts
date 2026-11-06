export interface SnapshotStore {
  read(): Promise<string | null>;
  write(body: string): Promise<void>;
}
