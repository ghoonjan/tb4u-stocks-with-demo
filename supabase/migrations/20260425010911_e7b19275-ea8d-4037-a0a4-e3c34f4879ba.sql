CREATE POLICY "Users can delete own briefings"
ON public.daily_briefings
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);