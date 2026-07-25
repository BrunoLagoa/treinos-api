import { prisma } from "../lib/db.js";

interface InputWorkoutPlans {
  userId: string;
  active?: boolean;
}

interface OutputWorkoutPlan {
  id: string;
  name: string;
  isActive: boolean;
  workoutDaysCount: number;
  createdAt: string;
}

export class ListWorkoutPlans {
  async execute(workoutPlans: InputWorkoutPlans): Promise<OutputWorkoutPlan[]> {
    const existingWorkoutPlans = await prisma.workoutPlan.findMany({
      where: {
        userId: workoutPlans.userId,
        ...(workoutPlans.active !== undefined && {
          isActive: workoutPlans.active,
        }),
      },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { workoutDays: true },
        },
      },
    });

    return existingWorkoutPlans.map((workoutPlan) => ({
      id: workoutPlan.id,
      name: workoutPlan.name,
      isActive: workoutPlan.isActive,
      workoutDaysCount: workoutPlan._count.workoutDays,
      createdAt: workoutPlan.createdAt.toISOString(),
    }));
  }
}
