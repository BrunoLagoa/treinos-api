import { NotFoundError } from "../errors/index.js";
import { prisma } from "../lib/db.js";

interface InputUserTrainData {
  userId: string;
  weightInGrams: number;
  heightInCentimeters: number;
  age: number;
  bodyFatPercentage: number;
}

interface OutputUserTrainData {
  userId: string;
  weightInGrams: number;
  heightInCentimeters: number;
  age: number;
  bodyFatPercentage: number;
}

export class UpsertUserTrainData {
  async execute(
    userTrainData: InputUserTrainData,
  ): Promise<OutputUserTrainData> {
    const existingUser = await prisma.user.findUnique({
      where: { id: userTrainData.userId },
    });

    if (!existingUser) {
      throw new NotFoundError("User not found.");
    }

    const updatedUser = await prisma.user.update({
      where: { id: userTrainData.userId },
      data: {
        weightInGrams: userTrainData.weightInGrams,
        heightInCentimeters: userTrainData.heightInCentimeters,
        age: userTrainData.age,
        bodyFatPercentage: userTrainData.bodyFatPercentage,
      },
    });

    return {
      userId: updatedUser.id,
      weightInGrams: userTrainData.weightInGrams,
      heightInCentimeters: userTrainData.heightInCentimeters,
      age: userTrainData.age,
      bodyFatPercentage: userTrainData.bodyFatPercentage,
    };
  }
}
