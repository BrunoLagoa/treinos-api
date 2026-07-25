import {
  ForbiddenError,
  NotFoundError,
  WorkoutPlanNotActiveError,
  WorkoutSessionAlreadyStartedError,
} from "../errors/index.js";
import { prisma } from "../lib/db.js";

interface InputWorkoutSession {
  userId: string;
  workoutPlanId: string;
  workoutDayId: string;
}

interface OutputWorkoutSession {
  userWorkoutSessionId: string;
}

export class StartWorkoutSession {
  async execute(
    workoutSession: InputWorkoutSession,
  ): Promise<OutputWorkoutSession> {
    const workoutDay = await prisma.workoutDay.findFirst({
      where: {
        id: workoutSession.workoutDayId,
        workoutPlanId: workoutSession.workoutPlanId,
      },
      include: {
        workoutPlan: true,
      },
    });

    if (!workoutDay) {
      throw new NotFoundError("Workout day not found.");
    }

    if (workoutDay.workoutPlan.userId !== workoutSession.userId) {
      throw new ForbiddenError(
        "Only the workout plan owner can start a workout session.",
      );
    }

    if (!workoutDay.workoutPlan.isActive) {
      throw new WorkoutPlanNotActiveError("Workout plan is not active.");
    }

    const startedWorkoutSession = await prisma.workoutSession.findFirst({
      where: {
        workoutDayId: workoutDay.id,
        completedAt: null,
      },
    });

    if (startedWorkoutSession) {
      throw new WorkoutSessionAlreadyStartedError(
        "Workout day already has a session in progress.",
      );
    }

    const createdWorkoutSession = await prisma.workoutSession.create({
      data: {
        workoutDayId: workoutDay.id,
        startedAt: new Date(),
      },
    });

    return {
      userWorkoutSessionId: createdWorkoutSession.id,
    };
  }
}
