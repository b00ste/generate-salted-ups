for FILE in types/*.ts;
do
echo '// @ts-nocheck' | cat - $FILE > temp && mv temp $FILE
done

for FILE in types/**/*.ts;
do
echo '// @ts-nocheck' | cat - $FILE > temp && mv temp $FILE
done