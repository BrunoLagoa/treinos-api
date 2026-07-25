import { ForbiddenError, NotFoundError } from "../errors/index.js";
import { WeekDay } from "../generated/prisma/enums.js";
import { dayjs } from "../lib/dayjs.js";
import { prisma } from "../lib/db.js";

const DATE_FORMAT = "YYYY-MM-DD";

interface InputWorkoutDay {
  userId: string;
  workoutPlanId: string;
  workoutDayId: string;
}

interface OutputExercise {
  id: string;
  workoutDayId: string;
  name: string;
  order: number;
  sets: number;
  reps: number;
  restTimeInSeconds: number;
}

interface OutputSession {
  id: string;
  workoutDayId: string;
  startedAt: string;
  completedAt?: string;
}

interface OutputWorkoutDay {
  id: string;
  name: string;
  isRest: boolean;
  coverImageUrl?: string;
  estimatedDurationInSeconds: number;
  weekDay: WeekDay;
  exercises: OutputExercise[];
  sessions: OutputSession[];
}

export class GetWorkoutDay {
  async execute(workoutDay: InputWorkoutDay): Promise<OutputWorkoutDay> {
    const existingWorkoutDay = await prisma.workoutDay.findFirst({
      where: {
        id: workoutDay.workoutDayId,
        workoutPlanId: workoutDay.workoutPlanId,
      },
      include: {
        workoutPlan: true,
        exercises: {
          orderBy: { order: "asc" },
        },
        workoutSessions: {
          orderBy: { startedAt: "desc" },
        },
      },
    });

    if (!existingWorkoutDay) {
      throw new NotFoundError("Workout day not found.");
    }

    if (existingWorkoutDay.workoutPlan.userId !== workoutDay.userId) {
      throw new ForbiddenError(
        "Only the workout plan owner can read a workout day.",
      );
    }

    return {
      id: existingWorkoutDay.id,
      name: existingWorkoutDay.name,
      isRest: existingWorkoutDay.isRest,
      coverImageUrl: existingWorkoutDay.coverImageUrl ?? undefined,
      estimatedDurationInSeconds: existingWorkoutDay.estimatedTimeInSeconds,
      weekDay: existingWorkoutDay.weekDay,
      exercises: existingWorkoutDay.exercises.map((exercise) => ({
        id: exercise.id,
        workoutDayId: exercise.workoutDayId,
        name: exercise.name,
        order: exercise.order,
        sets: exercise.sets,
        reps: exercise.reps,
        restTimeInSeconds: exercise.restTimeInSeconds,
      })),
      sessions: existingWorkoutDay.workoutSessions.map((workoutSession) => ({
        id: workoutSession.id,
        workoutDayId: workoutSession.workoutDayId,
        startedAt: dayjs.utc(workoutSession.startedAt).format(DATE_FORMAT),
        completedAt: workoutSession.completedAt
          ? dayjs.utc(workoutSession.completedAt).format(DATE_FORMAT)
          : undefined,
      })),
    };
  }
}
