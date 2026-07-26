import { WeekDay } from "../generated/prisma/enums.js";
import { dayjs } from "../lib/dayjs.js";
import { prisma } from "../lib/db.js";

const DATE_FORMAT = "YYYY-MM-DD";

// Índice do dia da semana (0 = domingo), como retornado por dayjs().day().
const WEEK_DAY_BY_INDEX = [
  WeekDay.SUNDAY,
  WeekDay.MONDAY,
  WeekDay.TUESDAY,
  WeekDay.WEDNESDAY,
  WeekDay.THURSDAY,
  WeekDay.FRIDAY,
  WeekDay.SATURDAY,
];

// Janela máxima considerada ao calcular a sequência de treinos.
const STREAK_LOOKBACK_IN_DAYS = 365;

interface InputHome {
  userId: string;
  date: string;
}

interface OutputWorkoutDay {
  workoutPlanId: string;
  id: string;
  name: string;
  isRest: boolean;
  weekDay: WeekDay;
  estimatedDurationInSeconds: number;
  coverImageUrl?: string;
  exercisesCount: number;
}

interface OutputConsistency {
  workoutDayCompleted: boolean;
  workoutDayStarted: boolean;
}

interface OutputHome {
  activeWorkoutPlanId: string | null;
  todayWorkoutDay: OutputWorkoutDay | null;
  workoutStreak: number;
  consistencyByDay: Record<string, OutputConsistency>;
}

export class GetHome {
  async execute(home: InputHome): Promise<OutputHome> {
    const date = dayjs.utc(home.date);
    const weekStart = date.startOf("week");
    const weekEnd = date.endOf("week");

    const activeWorkoutPlan = await prisma.workoutPlan.findFirst({
      where: {
        userId: home.userId,
        isActive: true,
      },
      include: {
        workoutDays: {
          include: {
            _count: {
              select: { exercises: true },
            },
          },
        },
      },
    });

    const weekDay = WEEK_DAY_BY_INDEX[date.day()];

    const todayWorkoutDay = activeWorkoutPlan?.workoutDays.find(
      (workoutDay) => workoutDay.weekDay === weekDay,
    );

    const weekWorkoutSessions = await prisma.workoutSession.findMany({
      where: {
        workoutDay: {
          workoutPlan: { userId: home.userId },
        },
        startedAt: {
          gte: weekStart.toDate(),
          lte: weekEnd.toDate(),
        },
      },
    });

    const consistencyByDay = this.buildConsistencyByDay({
      weekStart,
      weekWorkoutSessions,
    });

    const completedWorkoutSessions = await prisma.workoutSession.findMany({
      where: {
        workoutDay: {
          workoutPlan: { userId: home.userId },
        },
        completedAt: { not: null },
        startedAt: {
          gte: date.subtract(STREAK_LOOKBACK_IN_DAYS, "day").toDate(),
          lte: date.endOf("day").toDate(),
        },
      },
      select: { startedAt: true },
    });

    const workoutStreak = this.countWorkoutStreak({
      date,
      completedWorkoutSessions,
      planWeekDays: new Set(
        activeWorkoutPlan?.workoutDays.map((workoutDay) => workoutDay.weekDay),
      ),
    });

    return {
      activeWorkoutPlanId: activeWorkoutPlan?.id ?? null,
      todayWorkoutDay:
        activeWorkoutPlan && todayWorkoutDay
          ? {
              workoutPlanId: activeWorkoutPlan.id,
              id: todayWorkoutDay.id,
              name: todayWorkoutDay.name,
              isRest: todayWorkoutDay.isRest,
              weekDay: todayWorkoutDay.weekDay,
              estimatedDurationInSeconds:
                todayWorkoutDay.estimatedTimeInSeconds,
              coverImageUrl: todayWorkoutDay.coverImageUrl ?? undefined,
              exercisesCount: todayWorkoutDay._count.exercises,
            }
          : null,
      workoutStreak,
      consistencyByDay,
    };
  }

  private buildConsistencyByDay({
    weekStart,
    weekWorkoutSessions,
  }: {
    weekStart: dayjs.Dayjs;
    weekWorkoutSessions: Array<{ startedAt: Date; completedAt: Date | null }>;
  }): Record<string, OutputConsistency> {
    const consistencyByDay = Object.fromEntries(
      Array.from({ length: 7 }, (_, index) => [
        weekStart.add(index, "day").format(DATE_FORMAT),
        { workoutDayCompleted: false, workoutDayStarted: false },
      ]),
    ) as Record<string, OutputConsistency>;

    weekWorkoutSessions.forEach((workoutSession) => {
      const day = dayjs.utc(workoutSession.startedAt).format(DATE_FORMAT);
      const consistency = consistencyByDay[day];

      if (!consistency) {
        return;
      }

      consistency.workoutDayStarted = true;
      consistency.workoutDayCompleted =
        consistency.workoutDayCompleted || workoutSession.completedAt !== null;
    });

    return consistencyByDay;
  }

  private countWorkoutStreak({
    date,
    completedWorkoutSessions,
    planWeekDays,
  }: {
    date: dayjs.Dayjs;
    completedWorkoutSessions: Array<{ startedAt: Date }>;
    planWeekDays: Set<WeekDay>;
  }): number {
    const completedDays = new Set(
      completedWorkoutSessions.map((workoutSession) =>
        dayjs.utc(workoutSession.startedAt).format(DATE_FORMAT),
      ),
    );

    let workoutStreak = 0;
    let cursor = date;

    for (let index = 0; index <= STREAK_LOOKBACK_IN_DAYS; index += 1) {
      if (completedDays.has(cursor.format(DATE_FORMAT))) {
        workoutStreak += 1;
        cursor = cursor.subtract(1, "day");
        continue;
      }

      // Dias que o plano ativo não prevê não quebram a sequência, assim como o
      // dia consultado, que ainda pode estar em andamento.
      const isPlannedDay = planWeekDays.has(WEEK_DAY_BY_INDEX[cursor.day()]);
      const isQueriedDay = cursor.isSame(date, "day");

      if (isPlannedDay && !isQueriedDay) {
        break;
      }

      cursor = cursor.subtract(1, "day");
    }

    return workoutStreak;
  }
}
