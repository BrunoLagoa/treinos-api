import { InvalidUserTrainDataError, NotFoundError } from "../errors/index.js";
import { prisma } from "../lib/db.js";

const MIN_BODY_FAT_PERCENTAGE = 0;
const MAX_BODY_FAT_PERCENTAGE = 100;

interface InputUserTrainData {
  userId: string;
  weightInGrams: number;
  heightInCentimeters: number;
  age: number;
  /** Inteiro de 0 a 100, onde 100 representa 100%. */
  bodyFatPercentage: number;
}

interface OutputUserTrainData {
  userId: string;
  weightInGrams: number;
  heightInCentimeters: number;
  age: number;
  /** Inteiro de 0 a 100, onde 100 representa 100%. */
  bodyFatPercentage: number;
}

export class UpsertUserTrainData {
  async execute(
    userTrainData: InputUserTrainData,
  ): Promise<OutputUserTrainData> {
    // As colunas são inteiras: sem essa checagem o Postgres arredonda valores
    // fracionários e o dado persistido diverge do que foi recebido.
    const integerFields = {
      weightInGrams: userTrainData.weightInGrams,
      heightInCentimeters: userTrainData.heightInCentimeters,
      age: userTrainData.age,
      bodyFatPercentage: userTrainData.bodyFatPercentage,
    };

    Object.entries(integerFields).forEach(([field, value]) => {
      if (!Number.isInteger(value)) {
        throw new InvalidUserTrainDataError(`${field} must be an integer.`);
      }
    });

    if (
      userTrainData.bodyFatPercentage < MIN_BODY_FAT_PERCENTAGE ||
      userTrainData.bodyFatPercentage > MAX_BODY_FAT_PERCENTAGE
    ) {
      throw new InvalidUserTrainDataError(
        `bodyFatPercentage must be between ${MIN_BODY_FAT_PERCENTAGE} and ${MAX_BODY_FAT_PERCENTAGE}.`,
      );
    }

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
      weightInGrams: updatedUser.weightInGrams ?? userTrainData.weightInGrams,
      heightInCentimeters:
        updatedUser.heightInCentimeters ?? userTrainData.heightInCentimeters,
      age: updatedUser.age ?? userTrainData.age,
      bodyFatPercentage:
        updatedUser.bodyFatPercentage ?? userTrainData.bodyFatPercentage,
    };
  }
}
