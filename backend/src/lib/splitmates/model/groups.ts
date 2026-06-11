import type { GroupCategory } from "./enums";
import type { Id } from "./ids";

export interface GroupRecord {
  id: Id;
  name: string;
  description?: string;
  category: GroupCategory;
  createdAt: string;
  updatedAt: string;
  memberIds: Id[];
  adminIds: Id[];
}
