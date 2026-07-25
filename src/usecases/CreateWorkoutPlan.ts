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
  coverImageUrl?: string | null;
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
  coverImageUrl: string | null;
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
              coverImageUrl: workoutDay.coverImageUrl,
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

      return {
        id: result.id,
        userId: result.userId,
        name: result.name,
        isActive: result.isActive,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        workoutDays: result.workoutDays.map((workoutDay) => ({
          id: workoutDay.id,
          name: workoutDay.name,
          weekDay: workoutDay.weekDay,
          isRest: workoutDay.isRest,
          estimatedTimeInSeconds: workoutDay.estimatedTimeInSeconds,
          coverImageUrl: workoutDay.coverImageUrl,
          exercises: workoutDay.exercises.map((exercise) => ({
            id: exercise.id,
            order: exercise.order,
            name: exercise.name,
            sets: exercise.sets,
            reps: exercise.reps,
            restTimeInSeconds: exercise.restTimeInSeconds,
          })),
        })),
      };
    });
  }
}
