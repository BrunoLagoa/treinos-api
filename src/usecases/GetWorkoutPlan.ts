import { ForbiddenError, NotFoundError } from "../errors/index.js";
import { WeekDay } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";

interface InputWorkoutPlan {
  userId: string;
  workoutPlanId: string;
}

interface OutputWorkoutDay {
  id: string;
  weekDay: WeekDay;
  name: string;
  isRest: boolean;
  coverImageUrl?: string;
  estimatedDurationInSeconds: number;
  exercisesCount: number;
}

interface OutputWorkoutPlan {
  id: string;
  name: string;
  workoutDays: OutputWorkoutDay[];
}

export class GetWorkoutPlan {
  async execute(workoutPlan: InputWorkoutPlan): Promise<OutputWorkoutPlan> {
    const existingWorkoutPlan = await prisma.workoutPlan.findUnique({
      where: { id: workoutPlan.workoutPlanId },
      include: {
        workoutDays: {
          orderBy: { weekDay: "asc" },
          include: {
            _count: {
              select: { exercises: true },
            },
          },
        },
      },
    });

    if (!existingWorkoutPlan) {
      throw new NotFoundError("Workout plan not found.");
    }

    if (existingWorkoutPlan.userId !== workoutPlan.userId) {
      throw new ForbiddenError(
        "Only the workout plan owner can read a workout plan.",
      );
    }

    return {
      id: existingWorkoutPlan.id,
      name: existingWorkoutPlan.name,
      workoutDays: existingWorkoutPlan.workoutDays.map((workoutDay) => ({
        id: workoutDay.id,
        weekDay: workoutDay.weekDay,
        name: workoutDay.name,
        isRest: workoutDay.isRest,
        coverImageUrl: workoutDay.coverImageUrl ?? undefined,
        estimatedDurationInSeconds: workoutDay.estimatedTimeInSeconds,
        exercisesCount: workoutDay._count.exercises,
      })),
    };
  }
}
