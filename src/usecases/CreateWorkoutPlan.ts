import { NotFoundError } from "../errors/index.js";
import { WeekDay } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";

interface InputWorkoutPlan {
  userId: string;
  name: string;
  workoutDays: WorkoutDay[];
}

interface OutputWorkoutPlan {
  id: string;
  userId: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  workoutDays: OutputWorkoutDay[];
}

interface WorkoutDay {
  name: string;
  weekDay: WeekDay;
  isRest: boolean;
  estimatedTimeInSeconds: number;
  exercises: Exercise[];
}

interface Exercise {
  order: number;
  name: string;
  sets: number;
  reps: number;
  restTimeInSeconds: number;
}

interface OutputWorkoutDay {
  id: string;
  name: string;
  weekDay: WeekDay;
  isRest: boolean;
  estimatedTimeInSeconds: number;
  exercises: OutputExercise[];
}

interface OutputExercise {
  id: string;
  order: number;
  name: string;
  sets: number;
  reps: number;
  restTimeInSeconds: number;
}

export class CreateWorkoutPlan {
  async execute(workoutPlan: InputWorkoutPlan): Promise<OutputWorkoutPlan> {
    const existingWorkoutPlan = await prisma.workoutPlan.findFirst({
      where: {
        isActive: true,
      },
    });

    return prisma.$transaction(async (tx) => {
      if (existingWorkoutPlan) {
        await tx.workoutPlan.update({
          where: { id: existingWorkoutPlan.id },
          data: { isActive: false },
        });
      }

      const createdWorkoutPlan = await tx.workoutPlan.create({
        data: {
          id: crypto.randomUUID(),
          name: workoutPlan.name,
          userId: workoutPlan.userId,
          isActive: true,
          workoutDays: {
            create: workoutPlan.workoutDays.map((workoutDay) => ({
              name: workoutDay.name,
              weekDay: workoutDay.weekDay,
              isRest: workoutDay.isRest,
              estimatedTimeInSeconds: workoutDay.estimatedTimeInSeconds,
              exercises: {
                create: workoutDay.exercises.map((exercise) => ({
                  order: exercise.order,
                  name: exercise.name,
                  sets: exercise.sets,
                  reps: exercise.reps,
                  restTimeInSeconds: exercise.restTimeInSeconds,
                })),
              },
            })),
          },
        },
      });

      const result = await tx.workoutPlan.findUnique({
        where: { id: createdWorkoutPlan.id },
        include: {
          workoutDays: {
            include: {
              exercises: true,
            },
          },
        },
      });

      if (!result) {
        throw new NotFoundError("Workout plan not found after creation.");
      }

      return result;
    });
  }
}
