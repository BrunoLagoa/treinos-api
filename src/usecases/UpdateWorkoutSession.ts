import { ForbiddenError, NotFoundError } from "../errors/index.js";
import { prisma } from "../lib/db.js";

interface InputWorkoutSession {
  userId: string;
  workoutPlanId: string;
  workoutDayId: string;
  workoutSessionId: string;
  completedAt: string;
}

interface OutputWorkoutSession {
  id: string;
  startedAt: string;
  completedAt: string;
}

export class UpdateWorkoutSession {
  async execute(
    workoutSession: InputWorkoutSession,
  ): Promise<OutputWorkoutSession> {
    const existingWorkoutSession = await prisma.workoutSession.findFirst({
      where: {
        id: workoutSession.workoutSessionId,
        workoutDayId: workoutSession.workoutDayId,
        workoutDay: {
          workoutPlanId: workoutSession.workoutPlanId,
        },
      },
      include: {
        workoutDay: {
          include: {
            workoutPlan: true,
          },
        },
      },
    });

    if (!existingWorkoutSession) {
      throw new NotFoundError("Workout session not found.");
    }

    if (
      existingWorkoutSession.workoutDay.workoutPlan.userId !==
      workoutSession.userId
    ) {
      throw new ForbiddenError(
        "Only the workout plan owner can update a workout session.",
      );
    }

    const completedAt = new Date(workoutSession.completedAt);

    const updatedWorkoutSession = await prisma.workoutSession.update({
      where: { id: existingWorkoutSession.id },
      data: { completedAt },
    });

    return {
      id: updatedWorkoutSession.id,
      startedAt: updatedWorkoutSession.startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
    };
  }
}
